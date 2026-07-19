"use client";

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="WalletBrief home">
          <span className="wordmark-mark" aria-hidden="true">W</span>
          WalletBrief
        </a>
      </header>
      <section className="hero error-hero">
        <p className="eyebrow">Read-only request stopped safely</p>
        <h1>Monad didn&apos;t answer.</h1>
        <p className="hero-copy">
          No action was submitted and no wallet was changed. Retry the live
          read when the network is ready.
        </p>
        <button className="retry-button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
