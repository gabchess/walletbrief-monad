import { defineChain } from "viem";
import { MONAD_CHAIN_ID, MONAD_RPC_URL } from "./config.js";

/** viem chain definition for Monad mainnet (id 143). Used by execute()'s wallet/public clients. */
export const monad = defineChain({
  id: MONAD_CHAIN_ID,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_RPC_URL] },
  },
});
