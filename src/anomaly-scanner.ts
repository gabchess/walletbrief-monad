import type { Address } from "viem";
import { APPROVAL_EVENT_TOPIC } from "./anomalies.js";
import { WATCHED_TOKENS } from "./config.js";
import type { CursorStore } from "./cursor.js";
import {
  TRANSFER_EVENT_TOPIC,
  assignLogsToWallets,
  buildWalletTopics,
  groupWalletsByNextBlock,
  makeViemScannerDeps,
  minBigInt,
  resolveFirstScanBlock,
  withBackoff,
  MAX_BLOCK_RANGE,
  type ScanLog,
  type ScannerDeps,
} from "./scanner.js";

/**
 * anomaly-scanner.ts -- incremental Approval + outgoing-Transfer log scan.
 * detectAnomalies()
 * (anomalies.ts) is pure and needs these two log streams supplied by a real
 * scan; the earlier implementation built the pure detector but not this fetch layer (scanner.ts's own
 * doc comment: "Outgoing-transfer / Approval-event scanning is the earlier implementation's anomaly-
 * detection territory ... add a second topic filter there if/when it needs
 * its own log shape").
 *
 * Reuses scanner.ts's exported windowing/backoff/wallet-grouping/log-demux
 * primitives instead of a second copy (DRY) -- the only new logic here is
 * WHICH two topic filters to query per window and where the caller's cursor
 * lives.
 *
 * ponytail: uses its OWN cursor store (a second FileCursorStore instance
 * pointed at config.ANOMALY_CURSOR_STORE_PATH), separate from scanner.ts's
 * incoming-transfer cursor. Sharing one cursor file across two different
 * log-kind scans would desync -- whichever scan runs first would advance the
 * shared "last scanned block" past the range the other scan still needs.
 * Upgrade path: merge into one combined multi-topic scan (one getLogs call
 * per window instead of two, one shared cursor) if scanner.ts's incoming-
 * transfer scan is ever generalized the same way -- deferred here to avoid
 * touching scanner.ts's already-tested scanWallets() internals for this
 * ticket.
 *
 * Scope matches scanner.ts's existing restriction: only the WATCHED_TOKENS
 * set (implementation's WMON). A real multi-token deploy would need a broader (or
 * unfiltered) `address` list -- out of scope for this demo's watched-token set.
 */

export interface WalletAnomalySignals {
  wallet: Address;
  /** ERC20 Approval logs where `wallet` is the owner (topics[1]). Feeds
   * detectAnomalies()'s new/stale-approval detection. */
  approvalLogs: ScanLog[];
  /** ERC20 Transfer logs where `wallet` is the sender (topics[1]). Feeds
   * detectAnomalies()'s drawdown ("has this approval been used") signal. */
  outgoingTransferLogs: ScanLog[];
  scannedToBlock: number;
}

export interface AnomalyScanOptions {
  /** First-run seed block when a wallet has no persisted anomaly-scan cursor
   * yet. Defaults to config.SCAN_START_BLOCK (same default as scanner.ts's
   * scanWallets, though the two cursors are tracked independently). */
  startBlock?: number;
  /** Maximum first-run window when no explicit start block or cursor exists. */
  lookbackBlocks?: number;
}

/**
 * scanAnomalySignals(wallets, cursorStore, deps, options) -> WalletAnomalySignals[]
 *
 * Same shape as scanner.ts's scanWallets(): per-wallet-group windowed
 * getLogs, advance-and-persist-only-after-success, sequential (not
 * concurrent) windows. Two getLogs calls per window (Approval, then outgoing
 * Transfer) instead of one -- the cursor for a window only advances once BOTH
 * calls for that window succeed, so a failure partway through never persists
 * a half-scanned window.
 */
export async function scanAnomalySignals(
  wallets: readonly Address[],
  cursorStore: CursorStore,
  deps: ScannerDeps = makeViemScannerDeps(),
  options: AnomalyScanOptions = {},
): Promise<WalletAnomalySignals[]> {
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
  const approvalLogsByWallet = new Map<Address, ScanLog[]>(
    wallets.map((w) => [w, []]),
  );
  const outgoingLogsByWallet = new Map<Address, ScanLog[]>(
    wallets.map((w) => [w, []]),
  );
  const tokenAddresses = WATCHED_TOKENS.map((t) => t.address as Address);

  for (const group of groups) {
    let nextBlock = group.nextBlock;

    while (nextBlock <= head) {
      const windowEnd = minBigInt(nextBlock + MAX_BLOCK_RANGE - 1n, head);
      const walletTopics = buildWalletTopics(group.wallets);

      let approvalLogs: ScanLog[];
      let outgoingLogs: ScanLog[];
      try {
        approvalLogs = await withBackoff(
          () =>
            deps.getLogs({
              address: tokenAddresses,
              topics: [APPROVAL_EVENT_TOPIC, walletTopics, null],
              fromBlock: nextBlock,
              toBlock: windowEnd,
            }),
          deps.sleep,
        );
        outgoingLogs = await withBackoff(
          () =>
            deps.getLogs({
              address: tokenAddresses,
              topics: [TRANSFER_EVENT_TOPIC, walletTopics, null],
              fromBlock: nextBlock,
              toBlock: windowEnd,
            }),
          deps.sleep,
        );
      } catch (err) {
        // Same "never silently drop a window" contract as scanner.ts's
        // scanWallets -- name exactly which block range and wallets failed.
        throw new Error(
          `scanAnomalySignals: getLogs failed for blocks [${nextBlock}, ${windowEnd}] ` +
            `(wallets: ${group.wallets.join(", ")}): ${
              (err as { message?: string })?.message ?? String(err)
            }`,
          { cause: err },
        );
      }

      const approvalByWallet = assignLogsToWallets(
        approvalLogs,
        group.wallets,
        1,
      );
      const outgoingByWallet = assignLogsToWallets(
        outgoingLogs,
        group.wallets,
        1,
      );
      for (const wallet of group.wallets) {
        approvalLogsByWallet
          .get(wallet)!
          .push(...(approvalByWallet.get(wallet) ?? []));
        outgoingLogsByWallet
          .get(wallet)!
          .push(...(outgoingByWallet.get(wallet) ?? []));
      }

      // Persist ONLY after both of this window's getLogs calls succeeded, and
      // sequentially -- same FileCursorStore read-modify-write race guard as
      // scanner.ts's scanWallets.
      for (const wallet of group.wallets) {
        await cursorStore.setCursor(wallet, Number(windowEnd));
      }

      nextBlock = windowEnd + 1n;
    }
  }

  return Promise.all(
    wallets.map(async (wallet) => ({
      wallet,
      approvalLogs: approvalLogsByWallet.get(wallet) ?? [],
      outgoingTransferLogs: outgoingLogsByWallet.get(wallet) ?? [],
      scannedToBlock:
        (await cursorStore.getCursor(wallet)) ?? Number(startBlock),
    })),
  );
}
