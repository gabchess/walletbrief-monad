import { describe, expect, it } from "vitest";
import { aggregatePnL, diff } from "../src/pnl.js";
import type { ValuedState } from "../src/types.js";

const WALLET = "0x000000000000000000000000000000000000dEaD";
const WALLET_2 = "0x1111111111111111111111111111111111111111";
const MON = "native";
const WMON = "0x3bd359c1119da7da1d913d1c4d2b7c461115433a";
const USDC = "0x1000000000000000000000000000000000000c";

/** Hand-built ValuedState fixture -- bigint-exact fields set directly (independent
 * of value()'s own arithmetic), per the tautological-test anti-pattern. */
function valuedState(
  wallet: string,
  balances: Array<{
    address: string;
    symbol: string;
    decimals: number;
    rawBalance: string;
    usdPrice: number;
    usdValueCents: number;
  }>,
  blockNumber = 1,
): ValuedState {
  const balancesWithDollar = balances.map((b) => ({
    ...b,
    usdValue: b.usdValueCents / 100,
  }));
  const totalUsdValueCents = balances.reduce(
    (sum, b) => sum + b.usdValueCents,
    0,
  );
  return {
    wallet,
    blockNumber,
    balances: balancesWithDollar,
    totalUsdValueCents,
    totalUsdValue: totalUsdValueCents / 100,
  };
}

describe("diff(prev, curr) -> PnLReport (implementation -- the P&L seam)", () => {
  it("first-run (no prior snapshot) yields a baseline, not a spurious 100% gain", () => {
    const curr = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "1500000000000000000",
        usdPrice: 0.02,
        usdValueCents: 3,
      },
    ]);
    const report = diff(undefined, curr);
    expect(report.isBaseline).toBe(true);
    expect(report.usdValueChangeCents).toBe(0);
    expect(report.tokens).toEqual([
      {
        address: MON,
        symbol: "MON",
        amountChange: "0",
        usdValueChangeCents: 0,
      },
    ]);
  });

  it("a price move (same holdings) produces the exact delta -- hand-computed independently", () => {
    // 100 MON held throughout. Price moves $0.02 -> $0.03. Expected delta:
    // 100 * 0.03 * 100 - 100 * 0.02 * 100 = 300 - 200 = 100 cents, computed by
    // hand here, not by re-running value()'s own math.
    const prev = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "100000000000000000000",
        usdPrice: 0.02,
        usdValueCents: 200,
      },
    ]);
    const curr = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "100000000000000000000",
        usdPrice: 0.03,
        usdValueCents: 300,
      },
    ]);
    const report = diff(prev, curr);
    expect(report.isBaseline).toBe(false);
    expect(report.usdValueChangeCents).toBe(100);
    expect(report.tokens).toEqual([
      {
        address: MON,
        symbol: "MON",
        amountChange: "0",
        usdValueChangeCents: 100,
      },
    ]);
  });

  it("an amount change (holdings grew) produces the exact amount + value delta", () => {
    const prev = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "100000000000000000000",
        usdPrice: 0.02,
        usdValueCents: 200,
      },
    ]);
    const curr = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "150000000000000000000",
        usdPrice: 0.02,
        usdValueCents: 300,
      },
    ]);
    const report = diff(prev, curr);
    expect(report.tokens).toEqual([
      {
        address: MON,
        symbol: "MON",
        amountChange: "50000000000000000000", // +50 MON, decimal string, bigint-safe
        usdValueChangeCents: 100,
      },
    ]);
    expect(report.usdValueChangeCents).toBe(100);
  });

  it("a newly-acquired token (absent from prev) counts its full value as a gain", () => {
    const prev = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "100000000000000000000",
        usdPrice: 0.02,
        usdValueCents: 200,
      },
    ]);
    const curr = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "100000000000000000000",
        usdPrice: 0.02,
        usdValueCents: 200,
      },
      {
        address: USDC,
        symbol: "USDC",
        decimals: 6,
        rawBalance: "5000000",
        usdPrice: 1.0,
        usdValueCents: 500,
      },
    ]);
    const report = diff(prev, curr);
    const usdcDelta = report.tokens.find((t) => t.address === USDC);
    expect(usdcDelta).toEqual({
      address: USDC,
      symbol: "USDC",
      amountChange: "5000000",
      usdValueChangeCents: 500,
    });
    expect(report.usdValueChangeCents).toBe(500);
  });

  it("a fully-disposed token (absent from curr) counts its full removed value as a loss", () => {
    const prev = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "100000000000000000000",
        usdPrice: 0.02,
        usdValueCents: 200,
      },
      {
        address: USDC,
        symbol: "USDC",
        decimals: 6,
        rawBalance: "5000000",
        usdPrice: 1.0,
        usdValueCents: 500,
      },
    ]);
    const curr = valuedState(WALLET, [
      {
        address: MON,
        symbol: "MON",
        decimals: 18,
        rawBalance: "100000000000000000000",
        usdPrice: 0.02,
        usdValueCents: 200,
      },
    ]);
    const report = diff(prev, curr);
    const usdcDelta = report.tokens.find((t) => t.address === USDC);
    expect(usdcDelta).toEqual({
      address: USDC,
      symbol: "USDC",
      amountChange: "-5000000",
      usdValueChangeCents: -500,
    });
    expect(report.usdValueChangeCents).toBe(-500);
  });
});

describe("aggregatePnL(reports) -> AggregatePnL (cross-wallet total)", () => {
  it("sums usdValueChangeCents across every wallet's PnLReport", () => {
    const walletAReport = diff(
      valuedState(WALLET, [
        {
          address: MON,
          symbol: "MON",
          decimals: 18,
          rawBalance: "100000000000000000000",
          usdPrice: 0.02,
          usdValueCents: 200,
        },
      ]),
      valuedState(WALLET, [
        {
          address: MON,
          symbol: "MON",
          decimals: 18,
          rawBalance: "100000000000000000000",
          usdPrice: 0.03,
          usdValueCents: 300,
        },
      ]),
    );
    const walletBReport = diff(
      valuedState(WALLET_2, [
        {
          address: WMON,
          symbol: "WMON",
          decimals: 18,
          rawBalance: "50000000000000000000",
          usdPrice: 0.02,
          usdValueCents: 100,
        },
      ]),
      valuedState(WALLET_2, [
        {
          address: WMON,
          symbol: "WMON",
          decimals: 18,
          rawBalance: "50000000000000000000",
          usdPrice: 0.01,
          usdValueCents: 50,
        },
      ]),
    );
    const aggregate = aggregatePnL([walletAReport, walletBReport]);
    // wallet A gained 100 cents, wallet B lost 50 cents -> net +50.
    expect(aggregate.totalUsdValueChangeCents).toBe(50);
    expect(aggregate.wallets).toEqual([walletAReport, walletBReport]);
  });

  it("a baseline wallet (no prior snapshot) contributes zero to the aggregate", () => {
    const baselineReport = diff(
      undefined,
      valuedState(WALLET, [
        {
          address: MON,
          symbol: "MON",
          decimals: 18,
          rawBalance: "100000000000000000000",
          usdPrice: 0.02,
          usdValueCents: 200,
        },
      ]),
    );
    const realReport = diff(
      valuedState(WALLET_2, [
        {
          address: WMON,
          symbol: "WMON",
          decimals: 18,
          rawBalance: "50000000000000000000",
          usdPrice: 0.02,
          usdValueCents: 100,
        },
      ]),
      valuedState(WALLET_2, [
        {
          address: WMON,
          symbol: "WMON",
          decimals: 18,
          rawBalance: "50000000000000000000",
          usdPrice: 0.03,
          usdValueCents: 150,
        },
      ]),
    );
    const aggregate = aggregatePnL([baselineReport, realReport]);
    // Not a spurious +200 from the baseline wallet's full $2.00 value -- only
    // the real +50 cent price move counts.
    expect(aggregate.totalUsdValueChangeCents).toBe(50);
  });

  it("returns a zero total for an empty wallet set", () => {
    expect(aggregatePnL([])).toEqual({
      wallets: [],
      totalUsdValueChangeCents: 0,
    });
  });
});
