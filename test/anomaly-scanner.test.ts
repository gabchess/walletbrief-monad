import { describe, expect, it, vi } from "vitest";
import { pad, type Address, type Hex } from "viem";
import type { CursorStore } from "../src/cursor.js";
import { APPROVAL_EVENT_TOPIC } from "../src/anomalies.js";
import { scanAnomalySignals } from "../src/anomaly-scanner.js";
import {
  TRANSFER_EVENT_TOPIC,
  type ScannerDeps,
  type ScanLog,
} from "../src/scanner.js";
import { WATCHED_TOKENS } from "../src/config.js";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const WALLET_2 = "0x2222222222222222222222222222222222222222" as Address;
const SPENDER = "0x3333333333333333333333333333333333333333" as Address;
const RECIPIENT = "0x4444444444444444444444444444444444444444" as Address;
const TOKEN = WATCHED_TOKENS[0]!.address as Address;

function toTopic(address: Address): Hex {
  return pad(address, { size: 32 }) as Hex;
}

function approvalLog(
  owner: Address,
  spender: Address,
  blockNumber: bigint,
): ScanLog {
  return {
    address: TOKEN,
    topics: [APPROVAL_EVENT_TOPIC, toTopic(owner), toTopic(spender)],
    data: "0x1" as Hex,
    blockNumber,
    transactionHash: "0xapproval" as Hex,
  };
}

function outgoingTransferLog(from: Address, blockNumber: bigint): ScanLog {
  return {
    address: TOKEN,
    topics: [TRANSFER_EVENT_TOPIC, toTopic(from), toTopic(RECIPIENT)],
    data: "0x1" as Hex,
    blockNumber,
    transactionHash: "0xtransfer" as Hex,
  };
}

/** In-memory CursorStore, mirrors scanner.test.ts's helper. */
function makeMemoryCursorStore(
  initial: Record<string, number> = {},
): CursorStore {
  const data = new Map(
    Object.entries(initial).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    getCursor: async (wallet) => data.get(wallet.toLowerCase()),
    setCursor: async (wallet, block) => {
      data.set(wallet.toLowerCase(), block);
    },
  };
}

function mockDeps(overrides: Partial<ScannerDeps> = {}): ScannerDeps {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(500n),
    getLogs: vi.fn().mockResolvedValue([]),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("scanAnomalySignals() -- Approval + outgoing-Transfer log scan", () => {
  it("uses the same bounded first-run start as the activity scanner", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(50_000n) });
    const store = makeMemoryCursorStore();

    await scanAnomalySignals([WALLET], store, deps, {
      lookbackBlocks: 10_000,
    } as never);

    expect(deps.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 40_001n }),
    );
  });

  it("returns [] for an empty wallet set without calling the RPC", async () => {
    const deps = mockDeps();
    const store = makeMemoryCursorStore();
    const results = await scanAnomalySignals([], store, deps);
    expect(results).toEqual([]);
    expect(deps.getBlockNumber).not.toHaveBeenCalled();
  });

  it("seeds the first scan from the configured start block and queries both log kinds", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(150n) });
    const store = makeMemoryCursorStore();

    await scanAnomalySignals([WALLET], store, deps, { startBlock: 100 });

    expect(deps.getLogs).toHaveBeenCalledTimes(2);
    const calls = (deps.getLogs as ReturnType<typeof vi.fn>).mock
      .calls as Array<
      [{ topics: unknown[]; fromBlock: bigint; toBlock: bigint }]
    >;
    for (const [params] of calls) {
      expect(params.fromBlock).toBe(100n);
      expect(params.toBlock).toBe(150n);
    }
    const topic0s = calls.map(([params]) => params.topics[0]);
    expect(topic0s).toEqual(
      expect.arrayContaining([APPROVAL_EVENT_TOPIC, TRANSFER_EVENT_TOPIC]),
    );
  });

  it("matches wallets at topics[1] (owner/from), not topics[2] (scanner.ts's incoming-transfer 'to' position)", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(150n) });
    const store = makeMemoryCursorStore();

    await scanAnomalySignals([WALLET], store, deps, { startBlock: 1 });

    const calls = (deps.getLogs as ReturnType<typeof vi.fn>).mock
      .calls as Array<[{ topics: unknown[] }]>;
    for (const [params] of calls) {
      expect(params.topics[1]).toEqual([toTopic(WALLET)]);
      expect(params.topics[2]).toBeNull();
    }
  });

  it("does NOT re-request blocks below the persisted cursor", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(250n) });
    const store = makeMemoryCursorStore({ [WALLET]: 200 });

    await scanAnomalySignals([WALLET], store, deps);

    const [params] = (deps.getLogs as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((params as { fromBlock: bigint }).fromBlock).toBe(201n);
  });

  it("assigns approval logs to the owner and outgoing-transfer logs to the sender", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi
        .fn()
        .mockResolvedValueOnce([approvalLog(WALLET, SPENDER, 50n)]) // Approval call
        .mockResolvedValueOnce([outgoingTransferLog(WALLET, 60n)]), // Transfer call
    });
    const store = makeMemoryCursorStore();

    const results = await scanAnomalySignals([WALLET], store, deps, {
      startBlock: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.approvalLogs).toHaveLength(1);
    expect(results[0]!.approvalLogs[0]!.blockNumber).toBe(50n);
    expect(results[0]!.outgoingTransferLogs).toHaveLength(1);
    expect(results[0]!.outgoingTransferLogs[0]!.blockNumber).toBe(60n);
  });

  it("batches wallets sharing the same cursor into ONE pair of getLogs calls", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(100n) });
    const store = makeMemoryCursorStore();

    await scanAnomalySignals([WALLET, WALLET_2], store, deps, {
      startBlock: 1,
    });

    expect(deps.getLogs).toHaveBeenCalledTimes(2); // one Approval call + one Transfer call, covering both wallets
    const [params] = (deps.getLogs as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((params as { topics: unknown[] }).topics[1]).toEqual(
      expect.arrayContaining([toTopic(WALLET), toTopic(WALLET_2)]),
    );
  });

  it("persists the cursor only after BOTH log kinds succeed for a window", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi
        .fn()
        .mockResolvedValueOnce([]) // Approval call succeeds
        .mockRejectedValueOnce(new Error("execution reverted")), // Transfer call fails
    });
    const store = makeMemoryCursorStore();

    await expect(
      scanAnomalySignals([WALLET], store, deps, { startBlock: 1 }),
    ).rejects.toThrow(/execution reverted/);

    expect(await store.getCursor(WALLET)).toBeUndefined();
  });

  it("surfaces a clear error naming the failed block window -- never silently drops a window", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(150n),
      getLogs: vi.fn().mockRejectedValue(new Error("429 Too Many Requests")),
    });
    const store = makeMemoryCursorStore();

    await expect(
      scanAnomalySignals([WALLET], store, deps, { startBlock: 1 }),
    ).rejects.toThrow(/blocks \[1, 100\]/);
  });

  it("paginates in windows no larger than Monad RPC's 100-block limit", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(2500n) });
    const store = makeMemoryCursorStore();

    await scanAnomalySignals([WALLET], store, deps, { startBlock: 1 });

    // 25 windows x 2 log kinds each
    expect(deps.getLogs).toHaveBeenCalledTimes(50);
    expect(await store.getCursor(WALLET)).toBe(2500);
  });
});
