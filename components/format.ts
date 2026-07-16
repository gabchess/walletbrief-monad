import { formatUnits } from "viem";

/** Cent-precise USD formatting shared by the wallet brief components -- the
 * source values are bigint-exact cents (see src/value.ts), so this only
 * formats for display, never re-derives the number. */
export function formatUsdCents(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars > 0 ? "+" : "";
  return `${sign}$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Unsigned USD display (page.tsx's holdings table "USD Value" column -- a
 * balance is never negative, so formatUsdCents' "+" delta-sign convention
 * would misleadingly read as a gain). Display-only float division is fine
 * here; only the bigint-exact cents value (src/value.ts) is ever computed
 * with or persisted. */
export function formatUsdPlain(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Human-readable token amount from a raw (wei-like) balance string + its
 * decimals -- `viem.formatUnits` already does the bigint-safe division, so
 * this only rounds the float result for display (page.tsx's holdings table
 * "Balance" column; never used for any USD/value computation). */
export function formatTokenAmount(
  rawBalance: string,
  decimals: number,
): string {
  const amount = Number(formatUnits(BigInt(rawBalance), decimals));
  return amount.toLocaleString("en-US", { maximumFractionDigits: 4 });
}
