import type {
  PriceMap,
  RawState,
  ValuedBalance,
  ValuedState,
} from "./types.js";

/**
 * Fixed-point scale for USD prices: micro-USD (1e-6 dollars, 6 decimal digits of
 * price precision). review finding: the old `Number(formatUnits(rawBalance,
 * decimals))` path converts a potentially huge wei balance to a float BEFORE
 * multiplying by price -- for balances beyond Number.MAX_SAFE_INTEGER (2^53) that
 * loses precision at the whole-token level, not just in trailing decimals (e.g.
 * 9,007,199,254,740,993 tokens rounds to 9,007,199,254,740,992, a full dollar off
 * at $1/token).
 *
 * Fix: never convert the raw balance to a float. Quantize the (already-float,
 * externally-sourced) USD price to an integer ONCE, then do the whole
 * rawBalance * price computation in bigint, dividing down to whole cents with
 * round-half-up. One multiply + one rounded divide -- exact to the cent for any
 * token decimals count, no accumulated float error.
 *
 * ponytail: bigint fixed-point over adding a decimal.js dependency for this.
 */
const PRICE_SCALE = 1_000_000n; // micro-USD
const CENTS_PER_PRICE_SCALE = PRICE_SCALE / 100n; // 10_000n

function scalePriceToMicroUsd(usdPrice: number): bigint {
  return BigInt(Math.round(usdPrice * Number(PRICE_SCALE)));
}

/** Round-half-up integer division. Balances and prices are never negative here,
 * so a single `+ denominator/2n` before the floor division is sufficient. */
function divRoundBigInt(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

/** rawBalance (token's smallest unit) * price -> whole USD cents, bigint-exact. */
function toUsdValueCents(
  rawBalance: string,
  decimals: number,
  usdPrice: number,
): bigint {
  const priceMicroUsd = scalePriceToMicroUsd(usdPrice);
  const numerator = BigInt(rawBalance) * priceMicroUsd;
  const denominator = 10n ** BigInt(decimals) * CENTS_PER_PRICE_SCALE;
  return divRoundBigInt(numerator, denominator);
}

/**
 * value(RawState, priceMap) -> ValuedState
 *
 * Pure seam per the pure-boundary contract -- no I/O, fixture-testable. Unknown
 * tokens default to a zero USD price rather than throwing, so a single missing
 * price entry can't take down the whole briefing.
 */
export function value(raw: RawState, priceMap: PriceMap): ValuedState {
  const balances: ValuedBalance[] = raw.balances.map((balance) => {
    const usdPrice = priceMap[balance.address.toLowerCase()] ?? 0;
    const usdValueCents = Number(
      toUsdValueCents(balance.rawBalance, balance.decimals, usdPrice),
    );
    return {
      ...balance,
      usdPrice,
      usdValueCents,
      usdValue: usdValueCents / 100,
    };
  });

  const totalUsdValueCents = Number(
    balances.reduce((sum, b) => sum + BigInt(b.usdValueCents), 0n),
  );

  return {
    wallet: raw.wallet,
    blockNumber: raw.blockNumber,
    balances,
    totalUsdValueCents,
    totalUsdValue: totalUsdValueCents / 100,
  };
}
