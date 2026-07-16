import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { pad, toHex, type Address, type Hex } from "viem";
import type { CursorStore } from "../src/cursor.js";
import type { SnapshotStore } from "../src/snapshot.js";
import type { ApprovalStateStore } from "../src/approval-state.js";
import type { ReadDeps } from "../src/read.js";
import type { ScannerDeps, ScanLog } from "../src/scanner.js";
import { APPROVAL_EVENT_TOPIC } from "../src/anomalies.js";
import {
  runWalletBrief,
  warnOnLogMismatch,
  type WalletBriefDeps,
  type WalletSection,
  type WalletSectionResult,
} from "../src/orchestrate.js";
import { WATCHED_TOKENS } from "../src/config.js";
import type { ValuedState } from "../src/types.js";

/** Narrows a WalletSectionResult to its "ok" variant for tests that assert
 * on pipeline-result fields -- throws with the errored section's message if
 * the run unexpectedly failed for that wallet (review hardening, implementation). */
function assertOk(
  section: WalletSectionResult,
): asserts section is WalletSection {
  if (section.kind !== "ok") {
    throw new Error(
      `expected an "ok" WalletSection, got errored: ${section.message}`,
    );
  }
}

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const WALLET_2 = "0x2222222222222222222222222222222222222222" as Address;
const SPENDER = "0x3333333333333333333333333333333333333333" as Address;
const TOKEN = WATCHED_TOKENS[0]!.address as Address;

function toTopic(address: Address): Hex {
  return pad(address, { size: 32 }) as Hex;
}

function approvalLog(
  owner: Address,
  spender: Address,
  blockNumber: number,
): ScanLog {
  return {
    address: TOKEN,
    topics: [APPROVAL_EVENT_TOPIC, toTopic(owner), toTopic(spender)],
    data: toHex(2n ** 256n - 1n, { size: 32 }),
    blockNumber: BigInt(blockNumber),
    transactionHash: "0xapproval" as Hex,
  };
}

/** In-memory CursorStore, mirrors scanner.test.ts's helper. */
function makeMemoryCursorStore(): CursorStore {
  const data = new Map<string, number>();
  return {
    getCursor: async (wallet) => data.get(wallet.toLowerCase()),
    setCursor: async (wallet, block) => {
      data.set(wallet.toLowerCase(), block);
    },
  };
}

function makeMemorySnapshotStore(): SnapshotStore {
  const data = new Map<string, ValuedState>();
  return {
    getSnapshot: async (wallet) => data.get(wallet.toLowerCase()),
    setSnapshot: async (wallet, snapshot) => {
      data.set(wallet.toLowerCase(), snapshot);
    },
  };
}

function makeMemoryApprovalStateStore(): ApprovalStateStore {
  const data = new Map<string, Record<string, unknown>>();
  return {
    getApprovalState: async (wallet) => data.get(wallet.toLowerCase()) as never,
    setApprovalState: async (wallet, state) => {
      data.set(wallet.toLowerCase(), state as never);
    },
  };
}

function mockReadDeps(overrides: Partial<ReadDeps> = {}): ReadDeps {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(1000n),
    getBalance: vi.fn().mockResolvedValue(1_000_000_000_000_000_000n),
    readErc20Balance: vi.fn().mockResolvedValue(0n),
    ...overrides,
  };
}

function mockScannerDeps(overrides: Partial<ScannerDeps> = {}): ScannerDeps {
  return {
    // Blocks 0 through 99 exactly fill scanner.ts's 100-block MAX_BLOCK_RANGE,
    // so a scan from SCAN_START_BLOCK=0 always resolves in exactly one
    // window -- keeps this suite's per-call getLogs mocks (incoming-transfer,
    // Approval, outgoing-Transfer) aligned 1:1 with actual RPC calls.
    getBlockNumber: vi.fn().mockResolvedValue(99n),
    getLogs: vi.fn().mockResolvedValue([]),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockPriceFetcher(monPriceUsd = 2): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ monad: { usd: monPriceUsd } }),
  }) as unknown as typeof fetch;
}

function baseDeps(overrides: Partial<WalletBriefDeps> = {}): WalletBriefDeps {
  return {
    readDeps: mockReadDeps(),
    scannerDeps: mockScannerDeps(),
    priceFetcher: mockPriceFetcher(),
    cursorStore: makeMemoryCursorStore(),
    anomalyCursorStore: makeMemoryCursorStore(),
    snapshotStore: makeMemorySnapshotStore(),
    approvalStateStore: makeMemoryApprovalStateStore(),
    ...overrides,
  };
}

describe("runWalletBrief(wallets, deps) -> WalletBrief", () => {
  it("returns an empty brief for zero wallets without touching any dep", async () => {
    const deps = baseDeps();
    const brief = await runWalletBrief([], deps);
    expect(brief.wallets).toEqual([]);
    expect(brief.aggregate.totalUsdValueChangeCents).toBe(0);
    expect(brief.actionableWallet).toBeUndefined();
    expect(typeof (brief as { checkedAt?: unknown }).checkedAt).toBe("string");
    expect(
      Date.parse((brief as unknown as { checkedAt: string }).checkedAt),
    ).not.toBeNaN();
    expect(deps.readDeps.getBlockNumber).not.toHaveBeenCalled();
  });

  it("runs the full pipeline for one wallet: baseline PnL (no prior snapshot), no anomalies, no actionable wallet", async () => {
    const deps = baseDeps();
    const brief = await runWalletBrief([WALLET], deps);

    expect(brief.wallets).toHaveLength(1);
    const section = brief.wallets[0]!;
    assertOk(section);
    expect(section.wallet).toBe(WALLET);
    expect(section.pnl.isBaseline).toBe(true);
    expect(section.valued.totalUsdValueCents).toBeGreaterThan(0); // 1 MON @ $2
    expect(section.anomalies).toEqual([]);
    expect(section.proposedAction.hasActions).toBe(false);
    expect(brief.actionableWallet).toBeUndefined();
  });

  it("persists the ValuedState snapshot for the next run's diff", async () => {
    const deps = baseDeps();
    await runWalletBrief([WALLET], deps);
    const persisted = await deps.snapshotStore.getSnapshot(WALLET);
    expect(persisted).toBeDefined();
    expect(persisted?.wallet).toBe(WALLET);
  });

  it("detects a stale approval from the anomaly scan and produces an actionable ProposedAction", async () => {
    const deps = baseDeps({
      scannerDeps: mockScannerDeps({
        getLogs: vi
          .fn()
          // scanWallets' incoming-transfer call
          .mockResolvedValueOnce([])
          // scanAnomalySignals' Approval call
          .mockResolvedValueOnce([approvalLog(WALLET, SPENDER, 5)])
          // scanAnomalySignals' outgoing-Transfer call (never drawn down)
          .mockResolvedValueOnce([]),
      }),
    });

    const brief = await runWalletBrief([WALLET], deps);

    const section = brief.wallets[0]!;
    assertOk(section);
    expect(section.anomalies.some((a) => a.type === "stale-approval")).toBe(
      true,
    );
    expect(section.proposedAction.hasActions).toBe(true);
    expect(section.proposedAction.actions).toHaveLength(1);
    expect(brief.actionableWallet).toBe(section);
  });

  describe("review hardening (implementation, DEMO-CRITICAL): per-wallet failure isolation", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it("isolates one wallet's RPC throw into an errored section without aborting the rest of the brief", async () => {
      const deps = baseDeps({
        readDeps: mockReadDeps({
          getBalance: vi.fn().mockImplementation(async (address: Address) => {
            if (address.toLowerCase() === WALLET_2.toLowerCase()) {
              throw new Error("RPC hiccup: eth_getBalance timed out");
            }
            return 1_000_000_000_000_000_000n;
          }),
        }),
      });

      const brief = await runWalletBrief([WALLET, WALLET_2], deps);

      expect(brief.wallets).toHaveLength(2);
      const [okSection, erroredSection] = brief.wallets;
      assertOk(okSection!);
      expect(okSection.wallet).toBe(WALLET);

      expect(erroredSection!.kind).toBe("errored");
      expect(erroredSection!.wallet).toBe(WALLET_2);
      if (erroredSection!.kind === "errored") {
        expect(erroredSection!.message).toMatch(/RPC hiccup/);
      }

      // The errored wallet contributes nothing to the aggregate -- only the
      // ok wallet's baseline (zero-delta) PnL is counted.
      expect(brief.aggregate.wallets).toHaveLength(1);
      expect(errorSpy).toHaveBeenCalled();
    });

    it("still finds an actionable wallet among the ok sections when a different wallet in the same run errored", async () => {
      const deps = baseDeps({
        readDeps: mockReadDeps({
          getBalance: vi.fn().mockImplementation(async (address: Address) => {
            if (address.toLowerCase() === WALLET_2.toLowerCase()) {
              throw new Error("RPC hiccup");
            }
            return 1_000_000_000_000_000_000n;
          }),
        }),
        scannerDeps: mockScannerDeps({
          getLogs: vi
            .fn()
            .mockResolvedValueOnce([]) // incoming transfer
            .mockResolvedValueOnce([approvalLog(WALLET, SPENDER, 5)]) // approval
            .mockResolvedValueOnce([]), // outgoing transfer
        }),
      });

      const brief = await runWalletBrief([WALLET, WALLET_2], deps);

      expect(brief.actionableWallet?.wallet).toBe(WALLET);
      expect(brief.wallets.find((s) => s.wallet === WALLET_2)?.kind).toBe(
        "errored",
      );
    });
  });

  it("aggregates PnL across multiple wallets", async () => {
    const deps = baseDeps();
    const brief = await runWalletBrief([WALLET, WALLET_2], deps);
    expect(brief.wallets).toHaveLength(2);
    expect(brief.aggregate.wallets).toHaveLength(2);
    // Both baseline -> zero deltas by construction.
    expect(brief.aggregate.totalUsdValueChangeCents).toBe(0);
  });

  it("persists approval state for the caller's next run", async () => {
    const deps = baseDeps({
      scannerDeps: mockScannerDeps({
        getLogs: vi
          .fn()
          .mockResolvedValueOnce([]) // incoming transfer
          .mockResolvedValueOnce([approvalLog(WALLET, SPENDER, 5)]) // approval
          .mockResolvedValueOnce([]), // outgoing transfer
      }),
    });
    await runWalletBrief([WALLET], deps);
    const persisted = await deps.approvalStateStore.getApprovalState(WALLET);
    expect(persisted).toBeDefined();
  });

  describe("review hardening: owner/sender-mismatch observability", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    // Note: scanAnomalySignals' own topic-matched demux (assignLogsToWallets)
    // already filters a wrong-owner log out before it would ever reach
    // detectAnomalies for THIS wallet -- so a real owner-mismatch can't be
    // fabricated end-to-end through runWalletBrief without faking an RPC
    // response the real topics filter would never produce. warnOnLogMismatch
    // is exported specifically so this logging path is still directly
    // verifiable (see orchestrate.ts's doc comment on the function).
    it("warnOnLogMismatch logs when a debug counter is nonzero (unit-level, see orchestrate.ts doc comment for why this can't be fabricated end-to-end)", () => {
      warnOnLogMismatch(WALLET, {
        ignoredApprovalOwnerMismatch: 1,
        ignoredTransferSenderMismatch: 0,
      });
      expect(warnSpy).toHaveBeenCalled();
      const message = warnSpy.mock.calls[0]!.join(" ");
      expect(message).toMatch(/owner-mismatched/i);
      expect(message).toContain(WALLET);
    });

    it("warnOnLogMismatch stays silent when both counters are zero", () => {
      warnOnLogMismatch(WALLET, {
        ignoredApprovalOwnerMismatch: 0,
        ignoredTransferSenderMismatch: 0,
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does NOT warn during a real runWalletBrief pass where every log matches the scanned wallet", async () => {
      const deps = baseDeps({
        scannerDeps: mockScannerDeps({
          getLogs: vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([approvalLog(WALLET, SPENDER, 5)])
            .mockResolvedValueOnce([]),
        }),
      });

      await runWalletBrief([WALLET], deps);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
