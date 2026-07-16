#!/usr/bin/env tsx
// E2E smoke test (design rationale): read() + fetchPrices() + value() against REAL Monad
// mainnet for the first configured wallet. "Server started" is not "it
// works" -- this sends one real query and checks the response shape.
import type { Address } from "viem";
import { BRIEF_WALLETS } from "../src/config.js";
import { fetchPrices } from "../src/price.js";
import { read } from "../src/read.js";
import { value } from "../src/value.js";

async function main() {
  const wallet = BRIEF_WALLETS[0] as Address;
  console.log(`SMOKE: reading ${wallet} from Monad mainnet...`);
  const raw = await read(wallet);
  console.log(
    `SMOKE: read() OK -- block ${raw.blockNumber}, ${raw.balances.length} balances`,
  );

  const priceMap = await fetchPrices();
  console.log(`SMOKE: fetchPrices() OK -- MON = $${priceMap.native}`);

  const valued = value(raw, priceMap);
  console.log(`SMOKE: value() OK -- totalUsdValue = $${valued.totalUsdValue}`);
  console.log(JSON.stringify(valued, null, 2));
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
