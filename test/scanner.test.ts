import { describe, expect, it, vi } from "vitest";
import { pad, type Address, type Hex } from "viem";
import type { CursorStore } from "../src/cursor.js";
import {
  RATE_LIMIT_MAX_RETRIES,
  scanWallets,
  TRANSFER_EVENT_TOPIC,
  type ScannerDeps,
  type ScanLog,
} from "../src/scanner.js";
import { WATCHED_TOKENS } from "../src/config.js";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const WALLET_2 = "0x2222222222222222222222222222222222222222" as Address;
const OTHER = "0x3333333333333333333333333333333333333333" as Address;
const TOKEN = WATCHED_TOKENS[0]!.address as Address;

function toTopic(address: Address): Hex {
  return pad(address, { size: 32 }) as Hex;
}

function transferLog(to: Address, blockNumber: bigint): ScanLog {
  return {
    address: TOKEN,
    topics: [TRANSFER_EVENT_TOPIC, toTopic(OTHER), toTopic(to)],
    data: "0x0" as Hex,
    blockNumber,
    transactionHash: "0xabc" as Hex,
  };
}

/** In-memory CursorStore for tests that don't need to exercise real file I/O. */
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

describe("scanWallets() -- incremental scan seam (implementation)", () => {
  it("bounds a fresh scan to the configured lookback instead of starting at genesis", async () => {
    const scanner = await import("../src/scanner.js");
    const resolveFirstScanBlock = (
      scanner as unknown as {
        resolveFirstScanBlock?: (
          head: bigint,
          configuredStart?: number,
          lookback?: number,
        ) => bigint;
      }
    ).resolveFirstScanBlock;

    expect(resolveFirstScanBlock).toBeTypeOf("function");
    expect(resolveFirstScanBlock!(50_000n, undefined, 10_000)).toBe(40_001n);
    expect(resolveFirstScanBlock!(50_000n, 42_000, 10_000)).toBe(42_000n);
    expect(resolveFirstScanBlock!(5_000n, undefined, 10_000)).toBe(0n);
  });

  it("seeds the first scan from the configured start block when no cursor is persisted", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(150n) });
    const store = makeMemoryCursorStore();

    await scanWallets([WALLET], store, deps, { startBlock: 100 });

    expect(deps.getLogs).toHaveBeenCalledTimes(1);
    expect(deps.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 100n, toBlock: 150n }),
    );
  });

  it("does NOT re-request blocks below the persisted cursor", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(250n) });
    const store = makeMemoryCursorStore({ [WALLET]: 200 });

    await scanWallets([WALLET], store, deps);

    expect(deps.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 201n, toBlock: 250n }),
    );
  });

  it("paginates in windows no larger than Monad RPC's 100-block limit", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(2500n) });
    const store = makeMemoryCursorStore();

    await scanWallets([WALLET], store, deps, { startBlock: 1 });

    expect(deps.getLogs).toHaveBeenCalledTimes(25);
    const calls = (deps.getLogs as ReturnType<typeof vi.fn>).mock
      .calls as Array<[{ fromBlock: bigint; toBlock: bigint }]>;
    for (const [params] of calls) {
      expect(params.toBlock - params.fromBlock + 1n).toBeLessThanOrEqual(100n);
    }
    expect(calls[0]![0].fromBlock).toBe(1n);
    expect(calls[0]![0].toBlock).toBe(100n);
    expect(calls[1]![0].fromBlock).toBe(101n);
    expect(calls[24]![0].toBlock).toBe(2500n); // last window ends exactly at head
  });

  it("advances and persists the cursor only after a window succeeds -- a failed window leaves the cursor unchanged", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi.fn().mockRejectedValue(new Error("execution reverted")),
    });
    const store = makeMemoryCursorStore();

    await expect(
      scanWallets([WALLET], store, deps, { startBlock: 1 }),
    ).rejects.toThrow(/execution reverted/);

    expect(await store.getCursor(WALLET)).toBeUndefined();
  });

  it("persists partial progress: an earlier successful window's cursor survives a later window's failure", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(2500n),
      getLogs: vi
        .fn()
        .mockResolvedValueOnce([]) // window 1 [1, 100] succeeds
        .mockRejectedValueOnce(new Error("execution reverted")), // window 2 fails
    });
    const store = makeMemoryCursorStore();

    await expect(
      scanWallets([WALLET], store, deps, { startBlock: 1 }),
    ).rejects.toThrow(/execution reverted/);

    expect(deps.getLogs).toHaveBeenCalledTimes(2); // window 3 never attempted
    expect(await store.getCursor(WALLET)).toBe(100);
  });

  it("retries a 429 rate-limit error with backoff instead of dropping the window", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi
        .fn()
        .mockRejectedValueOnce(new Error("429 Too Many Requests"))
        .mockResolvedValueOnce([]),
    });
    const store = makeMemoryCursorStore();

    const results = await scanWallets([WALLET], store, deps, { startBlock: 1 });

    expect(deps.getLogs).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledTimes(1);
    expect(await store.getCursor(WALLET)).toBe(100);
    expect(results[0]!.scannedToBlock).toBe(100);
  });

  it("treats a JSON-RPC -32614 error code as rate-limit-class and retries", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi
        .fn()
        .mockRejectedValueOnce({ code: -32614, message: "capacity exceeded" })
        .mockResolvedValueOnce([]),
    });
    const store = makeMemoryCursorStore();

    await scanWallets([WALLET], store, deps, { startBlock: 1 });

    expect(deps.getLogs).toHaveBeenCalledTimes(2);
  });

  // review finding: viem's own error classes for rate-limit
  // conditions don't necessarily surface "429"/"rate limit" text in a
  // grep-able .message -- LimitExceededRpcError carries code -32005 (EIP-1474's
  // standard "limit exceeded") with message "Request exceeds defined limit.",
  // and HttpRequestError carries a numeric `.status` (429) rather than a
  // `.code`. A regex-only check over .message would silently miss both and
  // treat a genuine rate limit as a hard failure -- defeating this ticket's
  // whole purpose in exactly the scenario it exists to handle.
  it("treats viem's real LimitExceededRpcError (code -32005) as rate-limit-class and retries", async () => {
    const { LimitExceededRpcError } = await import("viem");
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi
        .fn()
        .mockRejectedValueOnce(
          new LimitExceededRpcError(new Error("rate limited")),
        )
        .mockResolvedValueOnce([]),
    });
    const store = makeMemoryCursorStore();

    await scanWallets([WALLET], store, deps, { startBlock: 1 });

    expect(deps.getLogs).toHaveBeenCalledTimes(2);
  });

  it("treats viem's real HttpRequestError with a 429 status as rate-limit-class and retries", async () => {
    const { HttpRequestError } = await import("viem");
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi
        .fn()
        .mockRejectedValueOnce(
          new HttpRequestError({
            url: "https://rpc1.monad.xyz",
            status: 429,
            body: {},
            details: "Too Many Requests",
          }),
        )
        .mockResolvedValueOnce([]),
    });
    const store = makeMemoryCursorStore();

    await scanWallets([WALLET], store, deps, { startBlock: 1 });

    expect(deps.getLogs).toHaveBeenCalledTimes(2);
  });

  it("increases the backoff delay on each successive retry (exponential, not constant)", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi
        .fn()
        .mockRejectedValueOnce(new Error("429"))
        .mockRejectedValueOnce(new Error("429"))
        .mockResolvedValueOnce([]),
    });
    const store = makeMemoryCursorStore();

    await scanWallets([WALLET], store, deps, { startBlock: 1 });

    const delays = (deps.sleep as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0] as number,
    );
    expect(delays).toHaveLength(2);
    expect(delays[1]).toBeGreaterThan(delays[0]!);
  });

  it("surfaces a clear error naming the failed block window after exhausting retries -- never silently drops a window", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi.fn().mockRejectedValue(new Error("429 Too Many Requests")),
    });
    const store = makeMemoryCursorStore();

    await expect(
      scanWallets([WALLET], store, deps, { startBlock: 1 }),
    ).rejects.toThrow(/blocks \[1, 100\]/);

    // bounded retries: initial attempt + RATE_LIMIT_MAX_RETRIES, then give up
    expect(deps.getLogs).toHaveBeenCalledTimes(RATE_LIMIT_MAX_RETRIES + 1);
  });

  it("batches wallets sharing the same cursor into ONE getLogs call instead of N separate scans", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(100n) });
    const store = makeMemoryCursorStore();

    await scanWallets([WALLET, WALLET_2], store, deps, { startBlock: 1 });

    expect(deps.getLogs).toHaveBeenCalledTimes(1);
    const [params] = (deps.getLogs as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const toTopics = (params as { topics: unknown[] }).topics[2] as Hex[];
    expect(toTopics).toEqual(
      expect.arrayContaining([toTopic(WALLET), toTopic(WALLET_2)]),
    );
  });

  it("does NOT batch wallets with divergent cursors -- scans each cursor group separately", async () => {
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(500n) });
    const store = makeMemoryCursorStore({ [WALLET]: 400, [WALLET_2]: 450 });

    await scanWallets([WALLET, WALLET_2], store, deps);

    expect(deps.getLogs).toHaveBeenCalledTimes(2);
  });

  it("assigns each returned log to the correct wallet by its `to` topic (batched-call demux)", async () => {
    const deps = mockDeps({
      getBlockNumber: vi.fn().mockResolvedValue(100n),
      getLogs: vi
        .fn()
        .mockResolvedValue([
          transferLog(WALLET, 50n),
          transferLog(WALLET_2, 60n),
        ]),
    });
    const store = makeMemoryCursorStore();

    const results = await scanWallets([WALLET, WALLET_2], store, deps, {
      startBlock: 1,
    });

    const byWallet = new Map(results.map((r) => [r.wallet, r]));
    expect(byWallet.get(WALLET)!.logs).toHaveLength(1);
    expect(byWallet.get(WALLET)!.logs[0]!.blockNumber).toBe(50n);
    expect(byWallet.get(WALLET_2)!.logs).toHaveLength(1);
    expect(byWallet.get(WALLET_2)!.logs[0]!.blockNumber).toBe(60n);
  });

  it("persists the cursor for every wallet in a batched group, not just the last one (FileCursorStore read-modify-write race guard)", async () => {
    const { FileCursorStore } = await import("../src/cursor.js");
    const { mkdtemp, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");

    const dir = await mkdtemp(path.join(tmpdir(), "walletbrief-scanner-test-"));
    const store = new FileCursorStore(path.join(dir, "cursors.json"));
    const deps = mockDeps({ getBlockNumber: vi.fn().mockResolvedValue(100n) });

    try {
      await scanWallets([WALLET, WALLET_2], store, deps, { startBlock: 1 });

      expect(await store.getCursor(WALLET)).toBe(100);
      expect(await store.getCursor(WALLET_2)).toBe(100);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
