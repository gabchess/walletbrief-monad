import type {
  AggregatePnL,
  PnLReport,
  TokenPnL,
  ValuedState,
} from "./types.js";

/**
 * diff(prev, curr) -> PnLReport
 *
 * The P&L seam: `diff(ValuedState_t0,
 * ValuedState_t1) -> PnLReport`). Pure, fixture-driven -- no I/O.
 *
 * Snapshot-diff valuation only (product spec locked non-goal): current holdings x current
 * price, delta since the last check. NOT historical cost-basis / tax-lot
 * accounting -- there is no notion of "when a token was acquired" here, only
 * "what changed between the last valued snapshot and this one."
 *
 * `prev` is `undefined` when this wallet has no prior snapshot (first-ever
 * valuation). That yields a baseline report with every delta forced to zero --
 * never (0 -> currentValue), which would read as a spurious 100% gain.
 */
export function diff(
  prev: ValuedState | undefined,
  curr: ValuedState,
): PnLReport {
  if (!prev) {
    return {
      wallet: curr.wallet,
      isBaseline: true,
      tokens: curr.balances.map((b) => ({
        address: b.address,
        symbol: b.symbol,
        amountChange: "0",
        usdValueChangeCents: 0,
      })),
      usdValueChangeCents: 0,
    };
  }

  const prevByAddress = new Map(
    prev.balances.map((b) => [b.address.toLowerCase(), b]),
  );
  const currByAddress = new Map(
    curr.balances.map((b) => [b.address.toLowerCase(), b]),
  );
  const allAddresses = [
    ...new Set([...prevByAddress.keys(), ...currByAddress.keys()]),
  ];

  const tokens: TokenPnL[] = allAddresses.map((address) => {
    const prevBalance = prevByAddress.get(address);
    const currBalance = currByAddress.get(address);
    const symbol = currBalance?.symbol ?? prevBalance?.symbol ?? address;
    const prevAmount = BigInt(prevBalance?.rawBalance ?? "0");
    const currAmount = BigInt(currBalance?.rawBalance ?? "0");
    const prevCents = prevBalance?.usdValueCents ?? 0;
    const currCents = currBalance?.usdValueCents ?? 0;
    return {
      address,
      symbol,
      amountChange: (currAmount - prevAmount).toString(),
      usdValueChangeCents: currCents - prevCents,
    };
  });

  return {
    wallet: curr.wallet,
    isBaseline: false,
    tokens,
    usdValueChangeCents: curr.totalUsdValueCents - prev.totalUsdValueCents,
  };
}

/**
 * aggregatePnL(reports) -> AggregatePnL
 *
 * Cross-wallet aggregate. Pure -- sums each wallet's PnLReport into
 * one total. Baseline wallets contribute 0 by construction (diff() already
 * zeroed their deltas), so a fresh wallet entering the set never skews the
 * aggregate.
 */
export function aggregatePnL(reports: readonly PnLReport[]): AggregatePnL {
  return {
    wallets: [...reports],
    totalUsdValueChangeCents: reports.reduce(
      (sum, r) => sum + r.usdValueChangeCents,
      0,
    ),
  };
}
