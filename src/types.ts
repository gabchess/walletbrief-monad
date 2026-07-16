// pure-boundary contract (see product spec.md "Test Seams"):
//   read(wallets[])                    -> RawState     (impure -- mock RPC in tests)
//   value(RawState, priceMap)          -> ValuedState  (pure)
// The initial implementation built these two seams end to end for ONE wallet. diff/prepare are read and value.

/** One token's raw on-chain balance for a wallet. `address` is "native" for MON itself. */
export interface TokenBalance {
  address: string;
  symbol: string;
  decimals: number;
  /** Balance in the token's smallest unit (wei), as a decimal string -- bigint-safe over JSON. */
  rawBalance: string;
}

/** Output of read(): a single wallet's on-chain state at a given block. */
export interface RawState {
  wallet: string;
  blockNumber: number;
  balances: TokenBalance[];
}

export interface ValuedBalance extends TokenBalance {
  usdPrice: number;
  /**
   * USD value in whole cents, bigint-exact (review finding fix -- see value.ts).
   * Safe as a JS number for any realistic wallet balance: Number.MAX_SAFE_INTEGER
   * cents is ~$90 trillion.
   */
  usdValueCents: number;
  /** Convenience dollar value, derived from usdValueCents (usdValueCents / 100). */
  usdValue: number;
}

/** Output of value(): RawState + USD pricing attached. */
export interface ValuedState {
  wallet: string;
  blockNumber: number;
  balances: ValuedBalance[];
  // review finding: usdValueCents (here and on ValuedBalance) is ALWAYS a
  // `number`, never a `bigint` -- bigint doesn't survive JSON.stringify/parse
  // (FileSnapshotStore's persistence layer), so no bigint may reach this field.
  /** Sum of every balance's usdValueCents -- bigint-exact, not a float sum. */
  totalUsdValueCents: number;
  /** Convenience dollar value, derived from totalUsdValueCents. */
  totalUsdValue: number;
}

/** token address (lowercased) or "native" -> USD price. Built by price.ts's fetchPrices(). */
export type PriceMap = Record<string, number>;

/** Per-token USD value + amount delta since the last snapshot (implementation). */
export interface TokenPnL {
  address: string;
  symbol: string;
  /** curr rawBalance - prev rawBalance, as a decimal string (bigint-safe, can be negative). */
  amountChange: string;
  /** curr usdValueCents - prev usdValueCents, bigint-exact (can be negative). */
  usdValueChangeCents: number;
}

/**
 * diff(prev, curr) -> PnLReport output (implementation). One wallet's P&L since its last
 * valued snapshot -- snapshot-diff valuation per the product spec's locked non-goals (current
 * holdings x current price, delta since last check; NOT cost-basis/tax-lot accounting).
 */
export interface PnLReport {
  wallet: string;
  /** True when there was no prior snapshot for this wallet (first-ever valuation).
   * A baseline has zero deltas by construction -- not a spurious 100% gain. */
  isBaseline: boolean;
  tokens: TokenPnL[];
  /** Sum of every token's usdValueChangeCents for this wallet. */
  usdValueChangeCents: number;
}

/** Cross-wallet aggregate of each configured wallet's change since its prior snapshot. */
export interface AggregatePnL {
  wallets: PnLReport[];
  /** Sum of every wallet's usdValueChangeCents. Baseline wallets contribute 0. */
  totalUsdValueChangeCents: number;
}
