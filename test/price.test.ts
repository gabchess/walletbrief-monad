import { describe, expect, it, vi } from "vitest";
import { fetchPrices } from "../src/price.js";
import { NATIVE_TOKEN, WATCHED_TOKENS } from "../src/config.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("fetchPrices() -> PriceMap (CoinGecko primary, DefiLlama fallback)", () => {
  it("uses CoinGecko's price when the primary call succeeds", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse({ monad: { usd: 0.0225 } }));
    const priceMap = await fetchPrices(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(priceMap[NATIVE_TOKEN]).toBe(0.0225);
  });

  it("prices every watched token the same as MON (WMON tracks MON 1:1 for the demo)", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse({ monad: { usd: 0.0225 } }));
    const priceMap = await fetchPrices(fetcher);
    for (const token of WATCHED_TOKENS) {
      expect(priceMap[token.address.toLowerCase()]).toBe(0.0225);
    }
  });

  it("falls back to DefiLlama when CoinGecko returns a non-2xx status", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 429)) // CoinGecko rate-limited
      .mockResolvedValueOnce(
        jsonResponse({ coins: { "coingecko:monad": { price: 0.0219 } } }),
      );
    const priceMap = await fetchPrices(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(priceMap[NATIVE_TOKEN]).toBe(0.0219);
  });

  it("falls back to DefiLlama when CoinGecko throws (network error/timeout)", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValueOnce(
        jsonResponse({ coins: { "coingecko:monad": { price: 0.0219 } } }),
      );
    const priceMap = await fetchPrices(fetcher);
    expect(priceMap[NATIVE_TOKEN]).toBe(0.0219);
  });

  it("throws a combined error when BOTH CoinGecko and DefiLlama fail", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(jsonResponse({}, false, 500));
    await expect(fetchPrices(fetcher)).rejects.toThrow(/price fetch failed/i);
  });

  // Carry A (review finding): `typeof NaN === "number"` passes the
  // old check, so a NaN price silently flowed through instead of falling back.
  describe("NaN/negative price guard (Carry A, design rationale)", () => {
    it("rejects a NaN price from CoinGecko and falls back to DefiLlama", async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ monad: { usd: NaN } }))
        .mockResolvedValueOnce(
          jsonResponse({ coins: { "coingecko:monad": { price: 0.0219 } } }),
        );
      const priceMap = await fetchPrices(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(priceMap[NATIVE_TOKEN]).toBe(0.0219);
    });

    it("rejects a negative price from CoinGecko and falls back to DefiLlama", async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ monad: { usd: -0.01 } }))
        .mockResolvedValueOnce(
          jsonResponse({ coins: { "coingecko:monad": { price: 0.0219 } } }),
        );
      const priceMap = await fetchPrices(fetcher);
      expect(priceMap[NATIVE_TOKEN]).toBe(0.0219);
    });

    it("throws the combined error when CoinGecko is NaN AND DefiLlama is negative", async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ monad: { usd: NaN } }))
        .mockResolvedValueOnce(
          jsonResponse({ coins: { "coingecko:monad": { price: -1 } } }),
        );
      await expect(fetchPrices(fetcher)).rejects.toThrow(/price fetch failed/i);
    });
  });
});
