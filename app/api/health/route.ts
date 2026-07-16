import { MONAD_CHAIN_ID } from "../../../src/config.js";

export function GET(): Response {
  return Response.json({ ok: true, chainId: MONAD_CHAIN_ID });
}
