import { encodeFunctionData, keccak256, toHex, type Address } from "viem";
import { ERC20_APPROVE_ABI } from "./abi.js";
import type { Anomaly, StaleApprovalAnomaly } from "./anomalies.js";
import { BATCH_EXECUTOR_ADDRESS } from "./config.js";
import type { Action, ProposedAction } from "./execute.js";
import type { PnLReport } from "./types.js";

/**
 * prepare(anomalies, pnlReport, implementationAddress?) -> ProposedAction
 *
 * The action-prep seam (implementation, pure-boundary contract: "prepare -- pure"). Builds
 * the ONE onchain action WalletBrief proposes per run: a batch-revoke of every
 * detected stale approval, as BatchExecutor `Action[]` (target = token,
 * calldata = `approve(spender, 0)`).
 *
 * Ticket-DAG's literal signature is `prepare(anomalies, PnLReport) -> ProposedAction`
 * (2 args). This adds a third `implementationAddress` param -- defaulted from
 * config.BATCH_EXECUTOR_ADDRESS so the 2-arg call still works -- instead of
 * reaching into config internally, so the function stays a pure, fixture-testable
 * seam like value()/diff() (every input explicit, no hidden env dependency).
 *
 * Only "stale-approval" anomalies are selected for revocation. "new-approval",
 * "failed-tx", and "balance-drift" anomalies are informational (surfaced in the
 * briefing) but never drive an onchain action -- Product constraint: "No autonomous
 * execution... every action is human-approved," and the demo action is
 * specifically the stale-approval batch-revoke (product spec user story 8).
 *
 * When there are no stale-approval anomalies, returns a well-formed
 * ProposedAction with `actions: []` rather than throwing -- "nothing to revoke
 * this run" is a valid outcome, not an error. BatchExecutor's own `EmptyBatch`
 * guard reverts on an empty actions array, so a future caller (the earlier implementation's approve
 * button / a CLI) must check `actions.length === 0` and skip calling execute()
 * entirely rather than submitting a doomed transaction -- prepare() only builds
 * the payload, it never decides whether to submit it.
 */
export function prepare(
  anomalies: readonly Anomaly[],
  pnlReport: PnLReport,
  implementationAddress: Address = BATCH_EXECUTOR_ADDRESS as Address,
): ProposedAction {
  const staleApprovals = anomalies
    .filter((a): a is StaleApprovalAnomaly => a.type === "stale-approval")
    .slice()
    .sort((a, b) =>
      `${a.token}:${a.spender}`.localeCompare(`${b.token}:${b.spender}`),
    );

  const actions: Action[] = staleApprovals.map((approval) => ({
    target: approval.token as Address,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [approval.spender as Address, 0n],
    }),
  }));

  return {
    implementationAddress,
    approvalDigest: buildApprovalDigest(pnlReport.wallet, staleApprovals),
    actions,
    // review hardening: type-level no-op signal -- callers (the web UI, orchestration)
    // check this BEFORE calling execute() rather than discovering an empty batch
    // only when BatchExecutor's EmptyBatch guard reverts on submission.
    hasActions: actions.length > 0,
  };
}

/**
 * Deterministic, content-derived digest -- NOT a random nonce. Hashing the wallet
 * plus the exact (token, spender, sinceBlock) set being revoked means an
 * identical revoke batch (same wallet, same stale set, same on-chain state)
 * always produces the same digest -- calling prepare() twice for an unchanged run
 * is naturally idempotent against BatchExecutor's single-use `usedDigests` guard,
 * while any real change (a new stale approval, a re-approval bumping
 * `sinceBlock`) produces a fresh, distinct digest.
 */
function buildApprovalDigest(
  wallet: string,
  staleApprovals: readonly StaleApprovalAnomaly[],
): `0x${string}` {
  const encoded = staleApprovals
    .map(
      (a) =>
        `${a.token.toLowerCase()}:${a.spender.toLowerCase()}:${a.blockNumber}`,
    )
    .join("|");
  return keccak256(toHex(`${wallet.toLowerCase()}|${encoded}`));
}
