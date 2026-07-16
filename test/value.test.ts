import { describe, expect, it } from "vitest";
import { value } from "../src/value.js";
import type { PriceMap, RawState } from "../src/types.js";

const WALLET = "0x000000000000000000000000000000000000dEaD";

const rawState: RawState = {
  wallet: WALLET,
  blockNumber: 88_000_000,
  balances: [
    {
      address: "native",
      symbol: "MON",
      decimals: 18,
      rawBalance: "1500000000000000000",
    }, // 1.5 MON
    {
      address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
      symbol: "WMON",
      decimals: 18,
      rawBalance: "2000000000000000000", // 2 WMON
    },
  ],
};

// Hand-computed expected values (independent of value()'s own arithmetic path) --
// 1.5 MON * $0.02 = $0.03, 2 WMON * $0.02 = $0.04, total $0.07.
const priceMap: PriceMap = {
  native: 0.02,
  "0x3bd359c1119da7da1d913d1c4d2b7c461115433a": 0.02, // priceMap keys are lowercased
};

describe("value(RawState, priceMap) -> ValuedState (pure)", () => {
  it("attaches a usdPrice and usdValue to every balance", () => {
    const state = value(rawState, priceMap);
    expect(state.balances[0]).toMatchObject({
      symbol: "MON",
      usdPrice: 0.02,
      usdValue: 0.03,
    });
    expect(state.balances[1]).toMatchObject({
      symbol: "WMON",
      usdPrice: 0.02,
      usdValue: 0.04,
    });
  });

  it("sums every balance's usdValue into totalUsdValue", () => {
    const state = value(rawState, priceMap);
    expect(state.totalUsdValue).toBeCloseTo(0.07, 10);
  });

  it("preserves wallet and blockNumber unchanged", () => {
    const state = value(rawState, priceMap);
    expect(state.wallet).toBe(WALLET);
    expect(state.blockNumber).toBe(88_000_000);
  });

  it("matches token addresses to prices case-insensitively", () => {
    const mixedCaseRaw: RawState = {
      ...rawState,
      balances: [
        {
          address: "0x3BD359C1119DA7DA1D913D1C4D2B7C461115433A", // upper-cased address
          symbol: "WMON",
          decimals: 18,
          rawBalance: "1000000000000000000",
        },
      ],
    };
    const state = value(mixedCaseRaw, priceMap);
    expect(state.balances[0]!.usdPrice).toBe(0.02);
  });

  it("defaults to a zero price for an unknown token instead of throwing", () => {
    const state = value(rawState, {});
    expect(state.balances[0]!.usdPrice).toBe(0);
    expect(state.balances[0]!.usdValue).toBe(0);
    expect(state.totalUsdValue).toBe(0);
  });

  it("returns an empty balances array unchanged for a wallet with no holdings", () => {
    const empty: RawState = { wallet: WALLET, blockNumber: 1, balances: [] };
    const state = value(empty, priceMap);
    expect(state.balances).toEqual([]);
    expect(state.totalUsdValue).toBe(0);
  });

  // review finding: value.ts did `Number(formatUnits(...))` float math. These
  // tests hand-compute the expected cent value independently of value()'s own
  // arithmetic path (never `rawBalance * price` re-derived the same way the code
  // does it), per the tautological-test anti-pattern.
  describe("cent-precise bigint math (review finding)", () => {
    it("values a 6-decimal token correctly (e.g. a USDC-like stablecoin)", () => {
      // 1.5 tokens at 6 decimals, $1.00/token -> $1.50 exactly = 150 cents.
      const raw: RawState = {
        wallet: WALLET,
        blockNumber: 1,
        balances: [
          {
            address: "0x1000000000000000000000000000000000000c",
            symbol: "USDC",
            decimals: 6,
            rawBalance: "1500000", // 1.5 * 10^6
          },
        ],
      };
      const state = value(raw, {
        "0x1000000000000000000000000000000000000c": 1.0,
      });
      expect(state.balances[0]!.usdValueCents).toBe(150);
      expect(state.balances[0]!.usdValue).toBe(1.5);
      expect(state.totalUsdValueCents).toBe(150);
    });

    it("does not lose precision for a balance beyond Number.MAX_SAFE_INTEGER (the float-drift bug)", () => {
      // 9,007,199,254,740,993 tokens (2^53 + 1) is the first integer a JS double
      // cannot represent exactly -- Number("9007199254740993") rounds DOWN to
      // 9007199254740992 (round-half-to-even), which is exactly the bug the old
      // `Number(formatUnits(...))` path was exposed to. At $1.00/token the true
      // value is $9,007,199,254,740,993.00 -- the old float path would have been
      // off by a full dollar. Hand-computed independently: amount * 100 cents.
      const TOKENS = 9_007_199_254_740_993n;
      const decimals = 18;
      const raw: RawState = {
        wallet: WALLET,
        blockNumber: 1,
        balances: [
          {
            address: "0x2000000000000000000000000000000000000c",
            symbol: "BIG",
            decimals,
            rawBalance: (TOKENS * 10n ** BigInt(decimals)).toString(),
          },
        ],
      };
      const state = value(raw, {
        "0x2000000000000000000000000000000000000c": 1.0,
      });
      const expectedCents = Number(TOKENS * 100n);
      expect(state.balances[0]!.usdValueCents).toBe(expectedCents);
      expect(state.totalUsdValueCents).toBe(expectedCents);
    });

    it("rounds a fractional-cent value to the nearest whole cent (round-half-up)", () => {
      // 1 token at $0.033/token = 3.3 cents -> rounds to 3 cents.
      const raw: RawState = {
        wallet: WALLET,
        blockNumber: 1,
        balances: [
          {
            address: "0x3000000000000000000000000000000000000c",
            symbol: "TINY",
            decimals: 18,
            rawBalance: "1000000000000000000", // 1 token
          },
        ],
      };
      const state = value(raw, {
        "0x3000000000000000000000000000000000000c": 0.033,
      });
      expect(state.balances[0]!.usdValueCents).toBe(3);
    });
  });
});
