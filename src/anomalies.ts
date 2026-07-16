import { keccak256, toHex, type Address, type Hex } from "viem";
import { TRANSFER_EVENT_TOPIC, type ScanLog } from "./scanner.js";
import type { PnLReport } from "./types.js";

/**
 * anomalies.ts -- rule-based anomaly detection (implementation). Product constraint: "No
 * ML/learned anomaly scoring" -- every rule here is a fixed, named threshold or
 * presence check, no model.
 *
 * detectAnomalies() is PURE (pure-boundary contract lists prepare() as the pure seam;
 * this module's detector is built the same way so it's fixture-testable with no
 * mocked RPC): every raw ScanLog is passed in by the caller (already scoped to the
 * scanned window), and prior ApprovalState is threaded in/out as a plain value
 * rather than read/written here. The impure persistence around it lives in
 * approval-state.ts (mirrors cursor.ts/snapshot.ts's read-then-let-caller-persist
 * split).
 */

/** keccak256("Approval(address,address,uint256)") -- the standard ERC20 Approval
 * event topic0. Computed at load time (not hardcoded), same reasoning as
 * scanner.ts's TRANSFER_EVENT_TOPIC: can't drift from the real signature. */
export const APPROVAL_EVENT_TOPIC = keccak256(
  toHex("Approval(address,address,uint256)"),
);

/** Decoded ERC20 Approval(address indexed owner, address indexed spender,
 * uint256 value) event. */
export interface DecodedApproval {
  token: Address;
  owner: Address;
  spender: Address;
  /** Allowance value set by this event, decimal string (bigint-safe, matches
   * TokenBalance.rawBalance's convention). */
  value: string;
  blockNumber: number;
  transactionHash: Hex;
}

/** A wallet-outgoing ERC20 Transfer (wallet is `from`) -- the drawdown signal for
 * approval staleness (see the ponytail note on ApprovalRecord.drawnDown below for
 * the exact assumption this is built on). */
export interface DecodedOutgoingTransfer {
  token: Address;
  from: Address;
  blockNumber: number;
}

/** A transaction submitted BY the scanned wallet that reverted (tx receipt
 * status=reverted). Resolving this from raw scan data is a read-layer concern
 * (eth_getTransactionReceipt per wallet-submitted tx) outside this pure seam --
 * detectAnomalies() takes the already-resolved list. */
export interface FailedTx {
  transactionHash: Hex;
  blockNumber: number;
}

/** A 32-byte left-padded topic's address is its last 20 bytes (40 hex chars) --
 * the exact inverse of scanner.ts's `walletTopic()` helper. */
function topicToAddress(topic: Hex): Address {
  return `0x${topic.slice(-40)}` as Address;
}

/**
 * decodeApprovalLog(log) -> DecodedApproval
 *
 * ERC20 Approval(address indexed owner, address indexed spender, uint256 value):
 * topics[0] = event signature, topics[1] = owner (32-byte left-padded address),
 * topics[2] = spender (same), data = value (32-byte big-endian uint256). Exact
 * decoding matters because every downstream staleness and drawdown decision uses
 * this result.
 *
 * Throws (never silently misdecodes) if topics[0] doesn't match the Approval
 * signature or owner/spender topics are missing.
 */
export function decodeApprovalLog(log: ScanLog): DecodedApproval {
  if (log.topics[0]?.toLowerCase() !== APPROVAL_EVENT_TOPIC.toLowerCase()) {
    throw new Error(
      `decodeApprovalLog: topic0 ${log.topics[0]} does not match the Approval ` +
        `event signature ${APPROVAL_EVENT_TOPIC} (tx ${log.transactionHash})`,
    );
  }
  const ownerTopic = log.topics[1];
  const spenderTopic = log.topics[2];
  if (!ownerTopic || !spenderTopic) {
    throw new Error(
      `decodeApprovalLog: missing owner/spender topic (tx ${log.transactionHash})`,
    );
  }
  return {
    token: log.address,
    owner: topicToAddress(ownerTopic),
    spender: topicToAddress(spenderTopic),
    value: BigInt(log.data).toString(),
    blockNumber: Number(log.blockNumber),
    transactionHash: log.transactionHash,
  };
}

/**
 * decodeOutgoingTransfer(log) -> DecodedOutgoingTransfer
 *
 * ERC20 Transfer(address indexed from, address indexed to, uint256 value):
 * topics[1] = from. Same defensive validation as decodeApprovalLog -- a
 * misclassified log here would silently corrupt the drawdown signal.
 */
export function decodeOutgoingTransfer(log: ScanLog): DecodedOutgoingTransfer {
  if (log.topics[0]?.toLowerCase() !== TRANSFER_EVENT_TOPIC.toLowerCase()) {
    throw new Error(
      `decodeOutgoingTransfer: topic0 ${log.topics[0]} does not match the ` +
        `Transfer event signature ${TRANSFER_EVENT_TOPIC} (tx ${log.transactionHash})`,
    );
  }
  const fromTopic = log.topics[1];
  if (!fromTopic) {
    throw new Error(
      `decodeOutgoingTransfer: missing from topic (tx ${log.transactionHash})`,
    );
  }
  return {
    token: log.address,
    from: topicToAddress(fromTopic),
    blockNumber: Number(log.blockNumber),
  };
}

/** Per (token, spender) tracked approval state, persisted across runs (implementation
 * carry B -- see approval-state.ts). */
export interface ApprovalRecord {
  token: Address;
  spender: Address;
  /** Latest live allowance (decimal string, bigint-safe). "0" means revoked. */
  allowance: string;
  /** Block of the most recent Approval() event that set `allowance` -- staleness
   * and drawdown are evaluated relative to THIS block, not the wallet's full
   * history. A fresh Approval event fully replaces the prior record, including
   * resetting `drawnDown` to false). */
  sinceBlock: number;
  /**
   * True once an outgoing transfer of `token` has been observed at/after
   * `sinceBlock`.
   *
   * ponytail: this is a PER-TOKEN drawdown signal, not per-spender. A standard
   * ERC20 `transferFrom` draw does not reliably re-emit an Approval event on
   * spend (OpenZeppelin's `_spendAllowance` suppresses it), so the only on-chain
   * signal available without an extra `eth_getTransactionReceipt`/tx-sender
   * lookup per outgoing transfer is the wallet's own Transfer log stream, which
   * cannot name WHICH spender pulled the funds. Any outgoing transfer of a token
   * is treated as "drawn down" for every spender approved on that token -- this
   * can produce a false negative (an actually-idle spender goes unflagged
   * because a DIFFERENT spender, or the wallet itself, moved the token), never a
   * false positive (an actively-used approval getting flagged/revoked). Given
   * this only feeds a human-approved revoke proposal (never auto-executes),
   * bias toward fewer false positives is the safer default. Upgrade path: join
   * each outgoing Transfer's transaction to its `tx.from` (the spender) via
   * `eth_getTransactionByHash` if per-spender precision is ever needed --
   * deferred until real usage shows the coarse signal missing genuine drainers.
   */
  drawnDown: boolean;
}

/** Keyed by `${token}:${spender}`, both lowercased. */
export type ApprovalState = Record<string, ApprovalRecord>;

function approvalKey(token: Address, spender: Address): string {
  return `${token.toLowerCase()}:${spender.toLowerCase()}`;
}

export interface FailedTxAnomaly {
  type: "failed-tx";
  transactionHash: Hex;
  blockNumber: number;
}

/** Shared fields between new-approval and stale-approval anomalies. Split into
 * two single-literal-discriminant interfaces (rather than one interface with a
 * `"new-approval" | "stale-approval"` union `type` field) so `Anomaly` stays a
 * properly narrowing discriminated union -- a two-literal `type` field is NOT
 * assignable to either literal alone, which breaks `Extract<Anomaly, {type:
 * "stale-approval"}>` (prepare.ts's revoke-selection filter) by collapsing it to
 * `never`. */
interface ApprovalAnomalyFields {
  token: Address;
  spender: Address;
  /** Live allowance at detection time, decimal string (bigint-safe). */
  allowance: string;
  /** Block of the most recent Approval() event that set this allowance. */
  blockNumber: number;
}

export interface NewApprovalAnomaly extends ApprovalAnomalyFields {
  type: "new-approval";
}

export interface StaleApprovalAnomaly extends ApprovalAnomalyFields {
  type: "stale-approval";
}

export interface BalanceDriftAnomaly {
  type: "balance-drift";
  address: string;
  symbol: string;
  amountChange: string;
  usdValueChangeCents: number;
}

export type Anomaly =
  | FailedTxAnomaly
  | NewApprovalAnomaly
  | StaleApprovalAnomaly
  | BalanceDriftAnomaly;

/** Named balance-drift threshold (Product constraint: "balance delta beyond a FIXED
 * threshold" -- no percentage-of-holdings model). ponytail: a flat $1.00
 * (100 cents) threshold is demo-appropriate for this project's wallet-set sizes;
 * upgrade path is a percentage-of-prior-value threshold if a fixed-dollar cutoff
 * miscalibrates across wallets of wildly different size. */
export const BALANCE_DRIFT_THRESHOLD_CENTS = 100;

export interface AnomalyDetectionInput {
  wallet: Address;
  /** Transactions submitted BY this wallet that reverted in the scanned window. */
  failedTxs: readonly FailedTx[];
  /** Raw Approval() event logs observed in the scanned window (any owner --
   * filtered to `wallet` internally as a defensive check). */
  approvalLogs: readonly ScanLog[];
  /** Raw Transfer() event logs observed in the scanned window, where `wallet` may
   * be the sender (filtered to `from === wallet` internally). */
  outgoingTransferLogs: readonly ScanLog[];
  /** Approval state carried over from the previous run (undefined on first run --
   * staleness is cumulative since the wallet's full scanned window began, product spec
   * Definitions, not just this run's incremental log window). */
  prevApprovalState: ApprovalState | undefined;
  /** This wallet's P&L for the current run (pnl.ts's diff() output) -- reused
   * here for balance-drift detection rather than re-deriving deltas from
   * ValuedState. */
  pnlReport: PnLReport;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  /** Updated ApprovalState for the caller to persist (approval-state.ts) before
   * the next run. */
  approvalState: ApprovalState;
  /**
   * Debug counters (review hardening). `decodeApprovalLog`/`decodeOutgoingTransfer`
   * are filtered to `owner`/`from` === the scanned wallet before ever entering
   * `state` -- correct for a wallet whose feed occasionally includes another
   * owner's log (e.g. a shared-topic batch scan), but a wallet whose EVERY log
   * mismatches signals a misconfigured wallet set (wrong address in
   * WATCH_WALLET/BRIEF_WALLETS, wrong scan window) rather than a genuine
   * "nothing happened" result. The filter used to drop these silently; this
   * surfaces the count instead so the caller (orchestration wiring) can log a
   * warning rather than the mismatch hiding inside a zero-anomaly result.
   */
  debug: {
    ignoredApprovalOwnerMismatch: number;
    ignoredTransferSenderMismatch: number;
  };
}

/**
 * detectAnomalies(input) -> { anomalies, approvalState }
 *
 * The anomaly-detection seam (implementation). Pure: no I/O, no RPC, no persistence --
 * every input is a plain value and the updated ApprovalState comes back as a
 * return value for the caller to persist. Detects three product spec-defined anomaly
 * classes, all rule-based (no ML, per non-goals):
 *
 * 1. failed-tx: 1:1 from `failedTxs`.
 * 2. new-approval / stale-approval: presence-based using the presence-based product rule
 *    -- "an approval that has not been drawn down since the scan window began."
 *    `new-approval` marks any (token, spender) pair whose Approval event was
 *    observed THIS run; `stale-approval` marks any live (non-zero) allowance with
 *    no drawdown yet, regardless of which run introduced it -- these can overlap
 *    (a brand-new approval with zero drawdown is both).
 * 3. balance-drift: any PnLReport token whose |usdValueChangeCents| meets
 *    BALANCE_DRIFT_THRESHOLD_CENTS.
 */
export function detectAnomalies(
  input: AnomalyDetectionInput,
): AnomalyDetectionResult {
  const wallet = input.wallet.toLowerCase();

  // Never mutate the caller's prevApprovalState (Immutability rule) -- shallow-
  // copy the map and every record we might touch.
  const state: ApprovalState = {};
  for (const [key, record] of Object.entries(input.prevApprovalState ?? {})) {
    state[key] = { ...record };
  }

  const allDecodedApprovals = input.approvalLogs.map(decodeApprovalLog);
  const decodedApprovals = allDecodedApprovals
    .filter((a) => a.owner.toLowerCase() === wallet)
    .sort((a, b) => a.blockNumber - b.blockNumber);
  const ignoredApprovalOwnerMismatch =
    allDecodedApprovals.length - decodedApprovals.length;

  const newKeys = new Set<string>();
  for (const approval of decodedApprovals) {
    const key = approvalKey(approval.token, approval.spender);
    state[key] = {
      token: approval.token,
      spender: approval.spender,
      allowance: approval.value,
      sinceBlock: approval.blockNumber,
      drawnDown: false,
    };
    newKeys.add(key);
  }

  const allDecodedTransfers = input.outgoingTransferLogs.map(
    decodeOutgoingTransfer,
  );
  const decodedOutgoingTransfers = allDecodedTransfers.filter(
    (t) => t.from.toLowerCase() === wallet,
  );
  const ignoredTransferSenderMismatch =
    allDecodedTransfers.length - decodedOutgoingTransfers.length;

  const outgoingBlocksByToken = new Map<string, number[]>();
  for (const transfer of decodedOutgoingTransfers) {
    const tokenKey = transfer.token.toLowerCase();
    const blocks = outgoingBlocksByToken.get(tokenKey) ?? [];
    blocks.push(transfer.blockNumber);
    outgoingBlocksByToken.set(tokenKey, blocks);
  }

  for (const key of Object.keys(state)) {
    const record = state[key]!;
    const blocks = outgoingBlocksByToken.get(record.token.toLowerCase()) ?? [];
    if (blocks.some((b) => b >= record.sinceBlock)) {
      state[key] = { ...record, drawnDown: true };
    }
  }

  const anomalies: Anomaly[] = [];

  for (const tx of input.failedTxs) {
    anomalies.push({
      type: "failed-tx",
      transactionHash: tx.transactionHash,
      blockNumber: tx.blockNumber,
    });
  }

  for (const key of Object.keys(state)) {
    const record = state[key]!;
    if (BigInt(record.allowance) === 0n) continue; // revoked -- never an anomaly
    if (newKeys.has(key)) {
      anomalies.push({
        type: "new-approval",
        token: record.token,
        spender: record.spender,
        allowance: record.allowance,
        blockNumber: record.sinceBlock,
      });
    }
    if (!record.drawnDown) {
      anomalies.push({
        type: "stale-approval",
        token: record.token,
        spender: record.spender,
        allowance: record.allowance,
        blockNumber: record.sinceBlock,
      });
    }
  }

  for (const token of input.pnlReport.tokens) {
    if (Math.abs(token.usdValueChangeCents) >= BALANCE_DRIFT_THRESHOLD_CENTS) {
      anomalies.push({
        type: "balance-drift",
        address: token.address,
        symbol: token.symbol,
        amountChange: token.amountChange,
        usdValueChangeCents: token.usdValueChangeCents,
      });
    }
  }

  return {
    anomalies,
    approvalState: state,
    debug: { ignoredApprovalOwnerMismatch, ignoredTransferSenderMismatch },
  };
}
