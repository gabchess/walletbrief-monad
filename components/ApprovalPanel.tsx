"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import type { ActiveApproval } from "../src/indexed-approvals.js";
import { addressExplorerUrl } from "../src/explorer.js";
import { RevokeButton } from "./RevokeButton.js";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; approvals: ActiveApproval[] };

export function ApprovalPanel({ owner }: { owner: Address }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetch(`/api/approvals?address=${owner}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          approvals?: ActiveApproval[];
          error?: string;
        };
        if (!response.ok || !body.approvals) {
          throw new Error(body.error ?? "Approval scan failed.");
        }
        setState({ kind: "ready", approvals: body.approvals });
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === "AbortError") return;
        setState({
          kind: "error",
          message:
            error instanceof Error ? error.message : "Approval scan failed.",
        });
      });
    return () => controller.abort();
  }, [owner]);

  if (state.kind === "loading") {
    return <ApprovalState title="Scanning approvals…" detail="Checking indexed ERC-20 events and current allowances." />;
  }
  if (state.kind === "error") {
    return <ApprovalState title="Approval scan unavailable" detail={state.message} tone="warning" />;
  }
  if (state.approvals.length === 0) {
    return <ApprovalState title="No active ERC-20 approvals found" detail="The indexed scan found no nonzero allowances for this address." tone="safe" />;
  }

  return (
    <section className="approval-section" aria-labelledby="approval-title">
      <div className="approval-section-heading">
        <div>
          <p className="eyebrow">Owner-controlled actions</p>
          <h3 id="approval-title">Active token approvals</h3>
        </div>
        <span className="status-badge">{state.approvals.length} found</span>
      </div>
      <div className="approval-list">
        {state.approvals.map((approval) => (
          <article className="approval-row" key={`${approval.token}:${approval.spender}`}>
            <div>
              <strong>{approval.symbol ?? shortAddress(approval.token)}</strong>
              <p>
                Spender{" "}
                <a href={addressExplorerUrl(approval.spender)} target="_blank" rel="noreferrer">
                  {shortAddress(approval.spender)}
                </a>
              </p>
            </div>
            <div className="allowance">
              <span>Allowance</span>
              <strong>{formatAllowance(approval)}</strong>
            </div>
            <RevokeButton approval={approval} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ApprovalState({
  title,
  detail,
  tone = "neutral",
}: {
  title: string;
  detail: string;
  tone?: "neutral" | "safe" | "warning";
}) {
  return (
    <section className={`approval-preview ${tone}`} aria-live="polite">
      <div className="status-icon" aria-hidden="true">{tone === "safe" ? "✓" : tone === "warning" ? "!" : "↗"}</div>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <span className="status-badge">Indexed</span>
    </section>
  );
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function formatAllowance(approval: ActiveApproval): string {
  if (approval.decimals === undefined) return approval.allowance;
  const value = formatUnits(BigInt(approval.allowance), approval.decimals);
  const asNumber = Number(value);
  return Number.isFinite(asNumber)
    ? asNumber.toLocaleString("en-US", { maximumFractionDigits: 4 })
    : value;
}
