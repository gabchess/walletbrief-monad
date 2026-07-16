import { NATIVE_TOKEN, WATCHED_TOKENS } from "./config.js";
import type { PriceMap } from "./types.js";

const COINGECKO_ID = "monad";
const COINGECKO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_ID}&vs_currencies=usd`;
const DEFILLAMA_URL = `https://coins.llama.fi/prices/current/coingecko:${COINGECKO_ID}`;

export type PriceFetcher = (url: string) => Promise<Response>;

/**
 * fetchPrices() -> PriceMap
 *
 * CoinGecko Monad Data API primary, DefiLlama fallback on any error / non-2xx /
 * thrown exception (review risk: "CoinGecko/DefiLlama API drift or downtime
 * during demo -- dual-source price fallback, implementation"). `fetcher` is injected so
 * tests can simulate both providers without touching the network.
 */
export async function fetchPrices(
  fetcher: PriceFetcher = fetch,
): Promise<PriceMap> {
  const monPrice = await fetchMonPriceUsd(fetcher);

  const priceMap: PriceMap = { [NATIVE_TOKEN]: monPrice };
  for (const token of WATCHED_TOKENS) {
    // the earlier implementation's only watched token (WMON) tracks MON 1:1. Non-MON-pegged tokens would
    // need their own CoinGecko id -- out of scope for the initial demo.
    priceMap[token.address.toLowerCase()] = monPrice;
  }
  return priceMap;
}

async function fetchMonPriceUsd(fetcher: PriceFetcher): Promise<number> {
  try {
    return await fetchFromCoinGecko(fetcher);
  } catch (coinGeckoError) {
    try {
      return await fetchFromDefiLlama(fetcher);
    } catch (defiLlamaError) {
      throw new Error(
        `price fetch failed: CoinGecko(${(coinGeckoError as Error).message}), ` +
          `DefiLlama(${(defiLlamaError as Error).message})`,
      );
    }
  }
}

// Carry A (review finding): `typeof price !== "number"` alone
// lets a NaN or negative price through -- `typeof NaN === "number"` is true, and a
// negative USD price is never valid. Number.isFinite() rejects NaN/Infinity;
// `price >= 0` rejects negative. Either check invalid -- fall through to the
// other source, same as a missing/malformed field.
function isValidPrice(price: unknown): price is number {
  return typeof price === "number" && Number.isFinite(price) && price >= 0;
}

async function fetchFromCoinGecko(fetcher: PriceFetcher): Promise<number> {
  const res = await fetcher(COINGECKO_URL);
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = (await res.json()) as { monad?: { usd?: number } };
  const price = json.monad?.usd;
  if (!isValidPrice(price))
    throw new Error(
      `CoinGecko: missing or invalid monad.usd in response (${String(price)})`,
    );
  return price;
}

async function fetchFromDefiLlama(fetcher: PriceFetcher): Promise<number> {
  const res = await fetcher(DEFILLAMA_URL);
  if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status}`);
  const json = (await res.json()) as {
    coins?: Record<string, { price?: number }>;
  };
  const price = json.coins?.[`coingecko:${COINGECKO_ID}`]?.price;
  if (!isValidPrice(price))
    throw new Error(
      `DefiLlama: missing or invalid price in response (${String(price)})`,
    );
  return price;
}
