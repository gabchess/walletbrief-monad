import { formatUnits } from "viem";
import { DEDICATED_DEMO_WALLET } from "../src/config.js";
import { addressExplorerUrl, blockExplorerUrl } from "../src/explorer.js";
import { loadPublicBrief, type PublicWalletBrief } from "../src/public-brief.js";
import { parseSearchAddress } from "../src/search.js";
import { ApprovalPanel } from "../components/ApprovalPanel.js";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawAddress = first(params.address)?.trim() ?? "";
  let brief: PublicWalletBrief | undefined;
  let error: string | undefined;

  if (rawAddress) {
    try {
      brief = await loadPublicBrief(parseSearchAddress(rawAddress));
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : "Monad did not return this wallet right now. Try again.";
    }
  }

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="WalletBrief home">
          <span className="wordmark-mark" aria-hidden="true">W</span>
          WalletBrief
        </a>
        <span className="network-pill">
          <span aria-hidden="true" /> Monad mainnet
        </span>
      </header>

      <section className="hero">
        <p className="eyebrow">Wallet clarity in seconds</p>
        <h1>Know what your wallet can do.</h1>
        <p className="hero-copy">
          Enter any Monad address for a live balance snapshot. Approval
          discovery and owner-controlled revokes are checked separately.
        </p>

        <form className="search" method="get" role="search">
          <label className="sr-only" htmlFor="wallet-address">
            Monad wallet address
          </label>
          <input
            id="wallet-address"
            name="address"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            defaultValue={rawAddress}
          />
          <button type="submit">Check wallet</button>
        </form>
        {!rawAddress && (
          <p className="example">
            No wallet handy?{" "}
            <a href={`/?address=${DEDICATED_DEMO_WALLET}`}>Try the live demo</a>
          </p>
        )}
      </section>

      {error && (
        <section className="notice error" role="alert">
          <strong>We couldn&apos;t check that wallet.</strong>
          <span>{error}</span>
        </section>
      )}

      {brief && <WalletResult brief={brief} />}

      <footer>
        Read-only by default. A revoke is prepared locally, simulated first,
        and signed only by the wallet owner.
      </footer>
    </main>
  );
}

function WalletResult({ brief }: { brief: PublicWalletBrief }) {
  return (
    <section className="result-panel" aria-labelledby="wallet-result-title">
      <div className="result-heading">
        <div>
          <p className="eyebrow">Live wallet snapshot</p>
          <h2 id="wallet-result-title">{shortAddress(brief.address)}</h2>
        </div>
        <a
          className="text-link"
          href={addressExplorerUrl(brief.address)}
          target="_blank"
          rel="noreferrer"
        >
          View in explorer ↗
        </a>
      </div>

      <div className="metrics">
        <Metric label="MON balance" value={formatAmount(brief.nativeBalance)} />
        <Metric label="WMON balance" value={formatAmount(brief.wmonBalance)} />
        <Metric label="Transactions" value={brief.transactionCount.toLocaleString("en-US")} />
        <Metric
          label="Latest block"
          value={brief.blockNumber.toLocaleString("en-US")}
          href={blockExplorerUrl(brief.blockNumber)}
        />
      </div>

      <p className="snapshot-speed">
        Four parallel read-only calls returned this snapshot in{" "}
        <strong>{brief.durationMs} ms</strong>.
      </p>
      <ApprovalPanel owner={brief.address} />
    </section>
  );
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = <strong>{value}</strong>;
  return (
    <div className="metric">
      <span>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">{content}</a>
      ) : (
        content
      )}
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatAmount(value: string): string {
  const raw = formatUnits(BigInt(value), 18);
  const [whole = "0", fraction = ""] = raw.split(".");
  const trimmed = fraction.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}
