import type { Address } from "viem";
import { BRIEF_WALLETS } from "../src/config.js";
import {
  runWalletBrief,
  type WalletSection,
  type WalletSectionResult,
} from "../src/orchestrate.js";
import type { Anomaly } from "../src/anomalies.js";
import type { AggregatePnL } from "../src/types.js";
import { withBriefLock } from "../src/brief-lock.js";
import {
  addressExplorerUrl,
  blockExplorerUrl,
} from "../src/explorer.js";
import { ApproveButton } from "../components/ApproveButton.js";
import {
  formatTokenAmount,
  formatUsdCents,
  formatUsdPlain,
  shortAddress,
} from "../components/format.js";

/**
 * app/page.tsx -- implementation's single-view brief. Non-obvious decision
 * (design rationale): this Server Component calls `runWalletBrief()` (src/orchestrate.ts)
 * DIRECTLY rather than through a `"use server"` Server Action in app/actions.ts.
 * Next.js's own convention (see app/actions.ts's doc comment, and
 * data-patterns.md: "Server Actions are the recommended way to handle
 * mutations") is that Server Components fetch data directly; Server Actions
 * are for CLIENT-triggered mutations. app/actions.ts's one action
 * (approveProposedAction) IS that mutation -- the approve-button click,
 * wired below via ApproveButton. Running the read-only brief pipeline
 * through a Server Action here would add an indirection with no behavior
 * change (a Server Action invoked at render time, not from a client event,
 * is not what the convention is for).
 *
 * `force-dynamic` is load-bearing, not decorative: this page performs live
 * Monad mainnet reads (config.ts's read-only RPC) plus local cursor/snapshot/
 * approval-state file writes on every request. Next's App Router defaults to
 * attempting static generation, and its fetch-patching can trigger those
 * calls DURING `next build` unless the route is explicitly opted out --
 * exactly the mainnet write gate (mainnet reads at request time only, never
 * at build time). See app/actions.ts's own mainnet write note for the sibling
 * constraint on execute() (local-anvil-fork only, never real mainnet).
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const wallets = BRIEF_WALLETS as Address[];

  if (wallets.length === 0) {
    return (
      <main>
        <h1>WalletBrief</h1>
        <p className="subhead">
          No wallets configured. Set BRIEF_WALLETS (comma-separated addresses)
          to brief real wallets.
        </p>
      </main>
    );
  }

  const brief = await withBriefLock(() => runWalletBrief(wallets));

  return (
    <main>
      <h1>WalletBrief</h1>
      <p className="subhead">
        {brief.wallets.length} wallet{brief.wallets.length === 1 ? "" : "s"}{" "}
        checked on Monad mainnet.
      </p>
      <p className="checked-at">
        <time dateTime={brief.checkedAt}>
          Last checked {formatCheckedAt(brief.checkedAt)}
        </time>
      </p>

      <AggregateCard aggregate={brief.aggregate} />

      {brief.wallets.map((section) => (
        <WalletCard key={section.wallet} section={section} />
      ))}

      <ActionCard section={brief.actionableWallet} />
    </main>
  );
}

function AggregateCard({ aggregate }: { aggregate: AggregatePnL }) {
  const cents = aggregate.totalUsdValueChangeCents;
  const sign = cents > 0 ? "pos" : cents < 0 ? "neg" : undefined;
  return (
    <p className={sign ? `aggregate ${sign}` : "aggregate"}>
      Aggregate P&amp;L across {aggregate.wallets.length} wallet
      {aggregate.wallets.length === 1 ? "" : "s"}: {formatUsdCents(cents)}
    </p>
  );
}

function WalletCard({ section }: { section: WalletSectionResult }) {
  if (section.kind === "errored") {
    return (
      <section className="card">
        <h2>
          <a href={addressExplorerUrl(section.wallet)}>
            {shortAddress(section.wallet)}
          </a>
        </h2>
        <p className="subhead">
          Wallet errored this run -- retry to check again.
        </p>
        <p className="neg">{section.message}</p>
      </section>
    );
  }

  const pnl = section.pnl;
  const deltaSign =
    pnl.usdValueChangeCents > 0
      ? "pos"
      : pnl.usdValueChangeCents < 0
        ? "neg"
        : undefined;

  return (
    <section className="card">
      <h2>
        <a href={addressExplorerUrl(section.wallet)}>
          {shortAddress(section.wallet)}
        </a>
      </h2>
      <p className="subhead">
        <a href={blockExplorerUrl(section.valued.blockNumber)}>
          Block {section.valued.blockNumber}
        </a>{" "}
        -- {section.activityLogCount}{" "}
        incoming transfer{section.activityLogCount === 1 ? "" : "s"} since last
        check
      </p>
      <p className={deltaSign}>
        {pnl.isBaseline
          ? "First check -- no prior snapshot to compare."
          : `Wallet P&L since last check: ${formatUsdCents(pnl.usdValueChangeCents)}`}
      </p>

      <HoldingsTable section={section} />

      <h3>Rule-based approval signal</h3>
      <AnomaliesList anomalies={section.anomalies} />
      <p className="limitation">
        Checks tracked WMON approvals in the bounded scan window. This is not
        a comprehensive security scan.
      </p>
    </section>
  );
}

function HoldingsTable({ section }: { section: WalletSection }) {
  const pnlByAddress = new Map(
    section.pnl.tokens.map((t) => [t.address.toLowerCase(), t]),
  );

  return (
    <table className="balances">
      <thead>
        <tr>
          <th>Token</th>
          <th>Balance</th>
          <th>USD Value</th>
          <th>Δ since last check</th>
        </tr>
      </thead>
      <tbody>
        {section.valued.balances.map((balance) => {
          const tokenPnl = pnlByAddress.get(balance.address.toLowerCase());
          const deltaCents = tokenPnl?.usdValueChangeCents ?? 0;
          const deltaSign =
            deltaCents > 0 ? "pos" : deltaCents < 0 ? "neg" : undefined;
          return (
            <tr key={balance.address}>
              <td>{balance.symbol}</td>
              <td>{formatTokenAmount(balance.rawBalance, balance.decimals)}</td>
              <td>{formatUsdPlain(balance.usdValueCents)}</td>
              <td className={deltaSign}>
                {section.pnl.isBaseline ? "--" : formatUsdCents(deltaCents)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AnomaliesList({ anomalies }: { anomalies: readonly Anomaly[] }) {
  if (anomalies.length === 0) {
    return <p className="subhead">No anomalies detected this run.</p>;
  }
  return (
    <ul className="anomaly-list">
      {anomalies.map((anomaly, i) => (
        // ponytail: index key is safe here -- this list is a fresh render of
        // a fresh detectAnomalies() result every request, never reordered or
        // individually removed in place.
        <li key={i}>{describeAnomaly(anomaly)}</li>
      ))}
    </ul>
  );
}

function describeAnomaly(anomaly: Anomaly): string {
  switch (anomaly.type) {
    case "failed-tx":
      return `Failed transaction ${shortAddress(anomaly.transactionHash)} at block ${anomaly.blockNumber}.`;
    case "new-approval":
      return `New approval: ${shortAddress(anomaly.spender)} can spend ${shortAddress(anomaly.token)}, since block ${anomaly.blockNumber}.`;
    case "stale-approval":
      return `Stale approval: ${shortAddress(anomaly.spender)} can still spend ${shortAddress(anomaly.token)} -- approved at block ${anomaly.blockNumber}, no spend observed since.`;
    case "balance-drift":
      return `${anomaly.symbol} balance moved ${formatUsdCents(anomaly.usdValueChangeCents)} since last check.`;
  }
}

function ActionCard({ section }: { section: WalletSection | undefined }) {
  if (!section) {
    return (
      <section className="card action-card">
        <h2>Proposed action</h2>
        <p className="subhead">
          Nothing to revoke this run -- every tracked approval has been drawn
          down or already revoked.
        </p>
      </section>
    );
  }

  const staleApprovals = section.anomalies.filter(
    (a): a is Extract<Anomaly, { type: "stale-approval" }> =>
      a.type === "stale-approval",
  );

  return (
    <section className="card action-card">
      <h2>Proposed action: batch revoke ({shortAddress(section.wallet)})</h2>
      <ul className="anomaly-list">
        {staleApprovals.map((a) => (
          <li key={`${a.token}:${a.spender}`}>
            Revoke allowance: spender {shortAddress(a.spender)} on token{" "}
            {shortAddress(a.token)} -- approved at block {a.blockNumber}, no
            drawdown observed since.
          </li>
        ))}
      </ul>
      <ApproveButton walletAddress={section.wallet} />
    </section>
  );
}

function formatCheckedAt(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(iso));
}
