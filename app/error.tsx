"use client";

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>WalletBrief</h1>
      <section className="card action-card">
        <h2>Live brief unavailable</h2>
        <p className="subhead">
          Monad data could not be loaded. No action was submitted.
        </p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
