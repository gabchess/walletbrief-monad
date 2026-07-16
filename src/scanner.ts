import {
  createPublicClient,
  http,
  keccak256,
  numberToHex,
  pad,
  toHex,
  type Address,
  type Hex,
} from "viem";
import {
  MONAD_RPC_URL,
  SCAN_LOOKBACK_BLOCKS,
  SCAN_START_BLOCK,
  WATCHED_TOKENS,
} from "./config.js";
import type { CursorStore } from "./cursor.js";

/**
 * scanner.ts -- incremental log scan + cursor. Wraps read.ts's point-in-time
 * balanceOf reads with a scan over
 * ERC20 Transfer logs so callers know what happened to a wallet since the last
 * scan, without ever rescanning full history.
 *
 * Scope (ponytail): matches only incoming ("to") Transfer events for the
 * WATCHED_TOKENS set. Outgoing-transfer / Approval-event scanning is the earlier implementation's
 * anomaly detection uses a separate topic filter
 * there if/when it needs its own log shape; the windowing/cursor/backoff
 * mechanics below are reusable as-is.
 *
 * SINGLE-PROCESS INVARIANT (review finding): this is the entrypoint that
 * reads-then-writes FileCursorStore's (and FileSnapshotStore's) JSON file per
 * scan window. WalletBrief assumes exactly one process ever runs this at a
 * time -- there is no cross-process file lock. Two concurrent processes
 * scanning the same wallet set would race the read-modify-write and could
 * silently drop a cursor/snapshot update. ponytail: document the constraint,
 * don't add a lockfile dependency for a single-operator demo agent; upgrade
 * path is a proper lock (or a real DB) if this ever runs as more than one
 * process against the same `.state/` directory.
 */

/** Minimal viem-log shape scanWallets() depends on and returns. */
export interface ScanLog {
  address: Address;
  topics: readonly Hex[];
  data: Hex;
  blockNumber: bigint;
  transactionHash: Hex;
}

/**
 * The impure I/O boundary scanWallets() depends on. Production code gets
 * `makeViemScannerDeps()`; unit tests inject a mock (same pattern as
 * read.ts's ReadDeps). `sleep` is part of the seam so backoff tests don't
 * have to wait through real delays.
 */
export interface ScannerDeps {
  getBlockNumber: () => Promise<bigint>;
  getLogs: (params: {
    address: Address[];
    topics: (Hex | Hex[] | null)[];
    fromBlock: bigint;
    toBlock: bigint;
  }) => Promise<ScanLog[]>;
  sleep: (ms: number) => Promise<void>;
}

export function makeViemScannerDeps(
  rpcUrl: string = MONAD_RPC_URL,
): ScannerDeps {
  const client = createPublicClient({ transport: http(rpcUrl) });
  return {
    getBlockNumber: () => client.getBlockNumber(),
    // viem's typed `client.getLogs()` only accepts ABI-based `event`/`args`
    // filters, not a raw topics array -- so this calls the underlying
    // eth_getLogs RPC method directly (same pattern viem's own getLogs()
    // action uses internally: hex-encode the block range, pass topics
    // through as-is) to get OR-matched multi-wallet topic filtering.
    getLogs: async (params) => {
      const rawLogs = await client.request({
        method: "eth_getLogs",
        params: [
          {
            address: params.address,
            topics: params.topics,
            fromBlock: numberToHex(params.fromBlock),
            toBlock: numberToHex(params.toBlock),
          },
        ],
      });
      return rawLogs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: BigInt(log.blockNumber ?? "0x0"),
        transactionHash: log.transactionHash as Hex,
      }));
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

export interface ScanOptions {
  /** First-run seed block when a wallet has no persisted cursor yet.
   * Defaults to config.SCAN_START_BLOCK. */
  startBlock?: number;
  /** Maximum first-run window when no explicit start block or cursor exists. */
  lookbackBlocks?: number;
}

export function resolveFirstScanBlock(
  head: bigint,
  configuredStart: number | undefined = SCAN_START_BLOCK,
  lookback: number = SCAN_LOOKBACK_BLOCKS,
): bigint {
  if (configuredStart !== undefined) return BigInt(configuredStart);
  const width = BigInt(lookback);
  return head + 1n > width ? head - width + 1n : 0n;
}

export interface WalletScanResult {
  wallet: Address;
  logs: ScanLog[];
  scannedToBlock: number;
}

/** keccak256("Transfer(address,address,uint256)") -- the standard ERC20 Transfer
 * event topic0. Computed at load time (not hardcoded) so it can't drift from
 * the real signature. */
export const TRANSFER_EVENT_TOPIC = keccak256(
  toHex("Transfer(address,address,uint256)"),
);

/** Monad mainnet's public RPC eth_getLogs block-range limit.
 * Exported so anomaly-scanner.ts's independent log scan reuses the same
 * window size instead of a second hardcoded constant. */
export const MAX_BLOCK_RANGE = 100n;

/** Bounded retries + exponential backoff for 429 / -32614 / rate-limit-class
 * errors. */
export const RATE_LIMIT_MAX_RETRIES = 5;
const RATE_LIMIT_BASE_DELAY_MS = 250;

/** JSON-RPC / HTTP codes that mean "rate limited or over a request-quota
 * limit". -32614 is the Alchemy-flavoured code named in the ticket; -32005 is
 * EIP-1474's standard "limit exceeded" code (the code viem's own
 * LimitExceededRpcError carries); 429 is the HTTP status viem's
 * HttpRequestError exposes via `.status`. Checked as numbers first because a
 * real RpcRequestError's `.code` doesn't always echo into `.message` in a
 * grep-able form. */
const RATE_LIMIT_CODES = new Set([-32614, -32005, 429]);

function isRateLimitError(err: unknown): boolean {
  const e = err as { message?: unknown; code?: unknown; status?: unknown };
  const code = typeof e?.code === "number" ? e.code : undefined;
  const status = typeof e?.status === "number" ? e.status : undefined;
  if (
    (code !== undefined && RATE_LIMIT_CODES.has(code)) ||
    (status !== undefined && RATE_LIMIT_CODES.has(status))
  ) {
    return true;
  }
  const message = String(e?.message ?? err);
  return /429|rate.?limit|-32614|-32005/i.test(message);
}

/** Exported (implementation) so anomaly-scanner.ts's independent log scan reuses the
 * same retry/backoff policy instead of a second copy. */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= RATE_LIMIT_MAX_RETRIES)
        throw err;
      // Exponential backoff (doubles per attempt) + up-to-50% jitter, so
      // concurrent/repeated retries don't all wake up on the same tick.
      const backoffMs = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
      const jitterMs = Math.random() * backoffMs * 0.5;
      await sleep(backoffMs + jitterMs);
    }
  }
}

/** Exported (implementation) so anomaly-scanner.ts can share the same window-size
 * clamp instead of a second copy. */
export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/** Exported (implementation) so anomaly-scanner.ts builds wallet-matched topic
 * filters the same way as this module's incoming-transfer scan. */
export function walletTopic(wallet: Address): Hex {
  return pad(wallet, { size: 32, dir: "left" }).toLowerCase() as Hex;
}

/** Builds the OR-matched topic filter for a batch of wallets sharing a
 * cursor -- this is what lets one getLogs call cover N wallets (implementation
 * step 4) instead of N separate calls. Exported (implementation) for reuse by
 * anomaly-scanner.ts. */
export function buildWalletTopics(wallets: readonly Address[]): Hex[] {
  return wallets.map(walletTopic);
}

/** Splits a batched call's logs back out per-wallet by matching each log's
 * wallet-role topic against the group's wallet set. `topicIndex` defaults to
 * 2 (this module's incoming-transfer "to" position, scanWallets' existing
 * behavior, unchanged); anomaly-scanner.ts passes 1 (the "owner"/"from"
 * position for Approval/outgoing-Transfer logs) -- same demux logic, just a
 * different topic slot, so implementation reuses this instead of a second copy. */
export function assignLogsToWallets(
  logs: readonly ScanLog[],
  wallets: readonly Address[],
  topicIndex: number = 2,
): Map<Address, ScanLog[]> {
  const walletByTopic = new Map(wallets.map((w) => [walletTopic(w), w]));
  const result = new Map<Address, ScanLog[]>(wallets.map((w) => [w, []]));
  for (const log of logs) {
    const roleTopic = log.topics[topicIndex]?.toLowerCase();
    const wallet = roleTopic ? walletByTopic.get(roleTopic as Hex) : undefined;
    if (wallet) result.get(wallet)!.push(log);
  }
  return result;
}

export interface WalletGroup {
  /** Next block to scan (cursor + 1, or the seed start block on first run). */
  nextBlock: bigint;
  wallets: Address[];
}

/** Groups wallets by their resolved next-block-to-scan so wallets that share
 * a starting point can be batched into one getLogs call.
 * Wallets can only share a call when they share a fromBlock -- batching a
 * wallet whose cursor is already ahead would re-request blocks below its
 * cursor, which step 2 bans. Exported (implementation) so anomaly-scanner.ts groups
 * wallets against its own (separate) cursor store the same way. */
export async function groupWalletsByNextBlock(
  wallets: readonly Address[],
  cursorStore: CursorStore,
  startBlock: bigint,
): Promise<WalletGroup[]> {
  const byNextBlock = new Map<string, WalletGroup>();
  for (const wallet of wallets) {
    const cursor = await cursorStore.getCursor(wallet);
    const nextBlock = cursor === undefined ? startBlock : BigInt(cursor) + 1n;
    const key = nextBlock.toString();
    const existing = byNextBlock.get(key);
    if (existing) existing.wallets.push(wallet);
    else byNextBlock.set(key, { nextBlock, wallets: [wallet] });
  }
  return [...byNextBlock.values()];
}

/**
 * scanWallets(wallets, cursorStore, deps, options) -> WalletScanResult[]
 *
 * The incremental scan seam (implementation test seam table). For each wallet,
 * reads its persisted cursor, then getLogs from cursor+1 to the current head,
 * paginated in <=100-block windows. Advances + persists each window's
 * wallets' cursors ONLY after that window's getLogs call succeeds, so a
 * failure partway through never loses already-scanned progress and never
 * re-requests blocks below a wallet's cursor.
 *
 * Sequential, not concurrent: unlike read.ts's Promise.all-based readMany(),
 * this deliberately scans group-by-group and window-by-window one at a time.
 * Concurrent log scans are exactly the RPC-burst risk this ticket exists to
 * mitigate.
 */
export async function scanWallets(
  wallets: readonly Address[],
  cursorStore: CursorStore,
  deps: ScannerDeps = makeViemScannerDeps(),
  options: ScanOptions = {},
): Promise<WalletScanResult[]> {
  if (wallets.length === 0) return [];

  const head = await withBackoff(() => deps.getBlockNumber(), deps.sleep);
  const startBlock = resolveFirstScanBlock(
    head,
    options.startBlock,
    options.lookbackBlocks,
  );
  const groups = await groupWalletsByNextBlock(
    wallets,
    cursorStore,
    startBlock,
  );
  const logsByWallet = new Map<Address, ScanLog[]>(wallets.map((w) => [w, []]));
  const tokenAddresses = WATCHED_TOKENS.map((t) => t.address as Address);

  for (const group of groups) {
    let nextBlock = group.nextBlock;

    while (nextBlock <= head) {
      const windowEnd = minBigInt(nextBlock + MAX_BLOCK_RANGE - 1n, head);

      let logs: ScanLog[];
      try {
        logs = await withBackoff(
          () =>
            deps.getLogs({
              address: tokenAddresses,
              topics: [
                TRANSFER_EVENT_TOPIC,
                null,
                buildWalletTopics(group.wallets),
              ],
              fromBlock: nextBlock,
              toBlock: windowEnd,
            }),
          deps.sleep,
        );
      } catch (err) {
        // Never silently drop a window's data: name exactly which block range
        // and wallets failed so the caller can see what's missing, instead of
        // a bare rethrow that loses that context.
        throw new Error(
          `scanWallets: getLogs failed for blocks [${nextBlock}, ${windowEnd}] ` +
            `(wallets: ${group.wallets.join(", ")}): ${
              (err as { message?: string })?.message ?? String(err)
            }`,
          { cause: err },
        );
      }

      const byWallet = assignLogsToWallets(logs, group.wallets);
      for (const wallet of group.wallets) {
        logsByWallet.get(wallet)!.push(...(byWallet.get(wallet) ?? []));
      }

      // Persist ONLY after this window's getLogs call succeeded, and
      // sequentially (not Promise.all) -- FileCursorStore's setCursor does a
      // read-modify-write over the whole cursor file, so concurrent writes
      // for wallets in the same batch would race and silently drop each
      // other's update.
      for (const wallet of group.wallets) {
        await cursorStore.setCursor(wallet, Number(windowEnd));
      }

      nextBlock = windowEnd + 1n;
    }
  }

  return Promise.all(
    wallets.map(async (wallet) => ({
      wallet,
      logs: logsByWallet.get(wallet) ?? [],
      scannedToBlock:
        (await cursorStore.getCursor(wallet)) ?? Number(startBlock),
    })),
  );
}
