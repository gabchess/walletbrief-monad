import type { Address } from "viem";
import {
  ANOMALY_CURSOR_STORE_PATH,
  APPROVAL_STATE_STORE_PATH,
  CURSOR_STORE_PATH,
  SNAPSHOT_STORE_PATH,
} from "./config.js";
import { scanAnomalySignals } from "./anomaly-scanner.js";
import { detectAnomalies, type Anomaly } from "./anomalies.js";
import {
  FileApprovalStateStore,
  type ApprovalStateStore,
} from "./approval-state.js";
import { FileCursorStore, type CursorStore } from "./cursor.js";
import { type ProposedAction } from "./execute.js";
import { prepare } from "./prepare.js";
import { aggregatePnL, diff } from "./pnl.js";
import { fetchPrices, type PriceFetcher } from "./price.js";
import { makeViemReadDeps, read, type ReadDeps } from "./read.js";
import {
  makeViemScannerDeps,
  scanWallets,
  type ScannerDeps,
} from "./scanner.js";
import { FileSnapshotStore, type SnapshotStore } from "./snapshot.js";
import type {
  AggregatePnL,
  PnLReport,
  RawState,
  ValuedState,
} from "./types.js";
import { value } from "./value.js";

/**
 * orchestrate.ts -- the "no live orchestration yet" seam the earlier implementation left open (ticket
 * implementation. Design rationale). Wires the read-to-action pure/impure seams together into one pipeline
 * per configured wallet: incremental scan -> value -> P&L diff -> detect
 * anomalies -> prepare the one batch-revoke action. Every dependency is
 * injected (WalletBriefDeps) so this is unit-testable with mocked RPC/stores,
 * matching every other impure seam in this codebase (read.ts's ReadDeps,
 * scanner.ts's ScannerDeps, etc.).
 */

export interface WalletBriefDeps {
  readDeps: ReadDeps;
  scannerDeps: ScannerDeps;
  priceFetcher: PriceFetcher;
  /** scanner.ts's incoming-transfer scan cursor (per-wallet "activity" feed). */
  cursorStore: CursorStore;
  /** anomaly-scanner.ts's Approval/outgoing-Transfer scan cursor -- a SEPARATE
   * cursor from `cursorStore` (see anomaly-scanner.ts's doc comment for why). */
  anomalyCursorStore: CursorStore;
  snapshotStore: SnapshotStore;
  approvalStateStore: ApprovalStateStore;
}

export function makeDefaultWalletBriefDeps(): WalletBriefDeps {
  return {
    readDeps: makeViemReadDeps(),
    scannerDeps: makeViemScannerDeps(),
    priceFetcher: fetch,
    cursorStore: new FileCursorStore(CURSOR_STORE_PATH),
    anomalyCursorStore: new FileCursorStore(ANOMALY_CURSOR_STORE_PATH),
    snapshotStore: new FileSnapshotStore(SNAPSHOT_STORE_PATH),
    approvalStateStore: new FileApprovalStateStore(APPROVAL_STATE_STORE_PATH),
  };
}

export interface WalletSection {
  kind: "ok";
  wallet: Address;
  raw: RawState;
  valued: ValuedState;
  pnl: PnLReport;
  anomalies: Anomaly[];
  /** Count of incoming-Transfer logs seen since the last scan (scanner.ts's
   * scanWallets) -- the per-wallet "activity" signal the web UI renders. */
  activityLogCount: number;
  proposedAction: ProposedAction;
}

/**
 * review hardening (implementation, DEMO-CRITICAL): one wallet's RPC/store failure inside
 * the per-wallet pipeline degrades to this variant instead of aborting the
 * whole brief -- a live demo showing N-1 good wallets plus one "wallet
 * errored" section beats the entire page throwing because one wallet's read
 * hiccupped. `message` is the caught error's message, safe to render (never
 * a raw Error object or stack trace).
 */
export interface WalletSectionError {
  kind: "errored";
  wallet: Address;
  message: string;
}

/** A run's outcome for one wallet -- either the full pipeline result, or an
 * isolated per-wallet failure (review hardening, implementation). page.tsx's WalletCard
 * discriminates on `.kind` before reading any `WalletSection`-only field. */
export type WalletSectionResult = WalletSection | WalletSectionError;

export interface WalletBrief {
  wallets: WalletSectionResult[];
  aggregate: AggregatePnL;
  checkedAt: string;
  /**
   * The ONE action this run proposes for human approval (product spec user stories
   * 7/8). Non-obvious decision (design rationale): execute() operates PER WALLET
   * (EIP-7702 self-delegation -- msg.sender === the submitting wallet), so a
   * single ProposedAction batch can never span multiple wallets' approvals.
   * "One action per run" therefore means: the first configured wallet (in
   * order) whose own ProposedAction has `hasActions === true`, not a merged
   * cross-wallet batch. `undefined` when no wallet has anything to revoke
   * this run -- a valid, non-error outcome (see prepare.ts).
   */
  actionableWallet: WalletSection | undefined;
}

/**
 * runWalletBrief(wallets, deps) -> WalletBrief
 *
 * The full read-to-action pipeline, run once per configured wallet:
 *   scan (incremental, both incoming-activity + anomaly-signal logs)
 *     -> value (cent-precise)
 *     -> diff (P&L vs last snapshot)
 *     -> detectAnomalies
 *     -> prepare (the one batch-revoke ProposedAction)
 *
 * Price is fetched once (fetchPrices() -- Monad's native MON price applies to
 * every wallet's holdings this run, same as value.ts's existing per-wallet
 * usage). The two scans batch every wallet sharing a cursor into as few
 * getLogs calls as possible (scanner.ts / anomaly-scanner.ts's existing
 * batching), so this stays RPC-burst-safe even for the full wallet set.
 */
export async function runWalletBrief(
  wallets: readonly Address[],
  deps: WalletBriefDeps = makeDefaultWalletBriefDeps(),
): Promise<WalletBrief> {
  if (wallets.length === 0) {
    return {
      wallets: [],
      aggregate: aggregatePnL([]),
      actionableWallet: undefined,
      checkedAt: new Date().toISOString(),
    };
  }

  const priceMap = await fetchPrices(deps.priceFetcher);

  // Incremental activity scan for incoming transfers.
  const activityScans = await scanWallets(
    wallets,
    deps.cursorStore,
    deps.scannerDeps,
  );
  const activityByWallet = new Map(
    activityScans.map((r) => [r.wallet.toLowerCase(), r]),
  );

  // Incremental anomaly-signal scan (Approval + outgoing Transfer logs) --
  // the fetch layer detectAnomalies() (pure) needs but the earlier implementation omitted.
  const anomalyScans = await scanAnomalySignals(
    wallets,
    deps.anomalyCursorStore,
    deps.scannerDeps,
  );
  const anomalyByWallet = new Map(
    anomalyScans.map((r) => [r.wallet.toLowerCase(), r]),
  );

  const sections: WalletSectionResult[] = [];

  for (const wallet of wallets) {
    try {
      const raw = await read(wallet, deps.readDeps);
      const valued = value(raw, priceMap);

      const prevSnapshot = await deps.snapshotStore.getSnapshot(wallet);
      const pnl = diff(prevSnapshot, valued);
      await deps.snapshotStore.setSnapshot(wallet, valued);

      const prevApprovalState =
        await deps.approvalStateStore.getApprovalState(wallet);
      const anomalyScan = anomalyByWallet.get(wallet.toLowerCase());
      const activityScan = activityByWallet.get(wallet.toLowerCase());

      const { anomalies, approvalState, debug } = detectAnomalies({
        wallet,
        // ponytail: failed-tx detection needs a per-sender "transactions by
        // address" lookup that plain JSON-RPC doesn't expose without an
        // indexer/enhanced API (Alchemy's asset-transfer/enhanced endpoints only
        // index successful transfers, never reverted txs, so they can't supply
        // this either) -- deferred, always empty for this demo. Upgrade path:
        // an indexer, or an Alchemy enhanced "transactions by address" API, if
        // this ever needs to be real.
        failedTxs: [],
        approvalLogs: anomalyScan?.approvalLogs ?? [],
        outgoingTransferLogs: anomalyScan?.outgoingTransferLogs ?? [],
        prevApprovalState,
        pnlReport: pnl,
      });
      await deps.approvalStateStore.setApprovalState(wallet, approvalState);
      warnOnLogMismatch(wallet, debug);

      const proposedAction = prepare(anomalies, pnl);

      sections.push({
        kind: "ok",
        wallet,
        raw,
        valued,
        pnl,
        anomalies,
        activityLogCount: activityScan?.logs.length ?? 0,
        proposedAction,
      });
    } catch (err) {
      // review hardening (implementation, DEMO-CRITICAL): one wallet's RPC/store throw
      // (read(), a snapshot/approval-state I/O failure) must not abort the
      // whole brief -- isolate it into an "errored" section and keep
      // briefing the rest of the configured wallets. This is the per-wallet
      // pipeline's own defense; app/error.tsx's boundary is the backstop for
      // anything that still escapes this try (e.g. the shared batched scans
      // above, which are wallet-set-wide and correctly still abort the whole
      // brief if they fail -- there is no single "one wallet" to isolate
      // there).
      const message = (err as { message?: unknown })?.message;
      console.error(
        `runWalletBrief: wallet ${wallet} errored, isolating from the rest of the brief: ` +
          `${typeof message === "string" ? message : String(err)}`,
      );
      sections.push({
        kind: "errored",
        wallet,
        message: typeof message === "string" ? message : String(err),
      });
    }
  }

  const okSections = sections.filter(
    (s): s is WalletSection => s.kind === "ok",
  );
  const aggregate = aggregatePnL(okSections.map((s) => s.pnl));
  const actionableWallet = okSections.find((s) => s.proposedAction.hasActions);

  return {
    wallets: sections,
    aggregate,
    actionableWallet,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * review hardening: surface (never silently hide) a nonzero owner/sender
 * mismatch count from detectAnomalies()'s debug counters -- a nonzero count
 * signals a misconfigured wallet set (wrong address, wrong scan window)
 * rather than a genuine "nothing happened" result. Extracted as its own
 * function (rather than inlined at the call site) so it's unit-testable in
 * isolation: scanAnomalySignals' own topic-matched demux (assignLogsToWallets)
 * already filters logs to the requesting wallet before they ever reach
 * detectAnomalies, so this path is correctly dormant in the real end-to-end
 * scan -- exercising it via a contrived `debug` object is the only way to
 * prove the logging code itself is correct without fabricating an RPC
 * response scanAnomalySignals' own filtering would never actually produce.
 */
export function warnOnLogMismatch(
  wallet: Address,
  debug: {
    ignoredApprovalOwnerMismatch: number;
    ignoredTransferSenderMismatch: number;
  },
): void {
  if (
    debug.ignoredApprovalOwnerMismatch > 0 ||
    debug.ignoredTransferSenderMismatch > 0
  ) {
    console.warn(
      `runWalletBrief: wallet ${wallet} dropped ${debug.ignoredApprovalOwnerMismatch} ` +
        `owner-mismatched Approval log(s) and ${debug.ignoredTransferSenderMismatch} ` +
        `sender-mismatched Transfer log(s) -- check BRIEF_WALLETS config / scan window.`,
    );
  }
}
