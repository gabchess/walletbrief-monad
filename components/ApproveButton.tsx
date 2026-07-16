"use client";

import { useState, useTransition } from "react";
import type { Address } from "viem";
import { approveProposedAction, type ApproveResult } from "../app/actions.js";
import { transactionExplorerUrl } from "../src/explorer.js";

export function ApproveButton({
  walletAddress,
}: {
  walletAddress: Address;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ApproveResult | null>(null);

  function onApprove() {
    startTransition(async () => {
      const r = await approveProposedAction(walletAddress);
      setResult(r);
    });
  }

  return (
    <div>
      <button
        onClick={onApprove}
        disabled={isPending || result?.kind === "executed"}
      >
        {isPending ? "Submitting..." : "Approve one batch revoke"}
      </button>
      {result && (
        <p className="result">
          {result.kind === "executed" &&
            (result.success
              ? <>
                  Executed at block {result.blockNumber}.{" "}
                  <a
                    href={transactionExplorerUrl(result.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View the revoke on MonadVision
                  </a>
                  .
                </>
              : `Reverted. Tx ${result.txHash} (block ${result.blockNumber}).`)}
          {result.kind === "noop" && `Nothing to revoke: ${result.reason}`}
          {result.kind === "rejected" && `Rejected: ${result.reason}`}
        </p>
      )}
    </div>
  );
}
