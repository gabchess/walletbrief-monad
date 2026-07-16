import { createPublicClient, http, type Address } from "viem";
import {
  MONAD_RPC_URL,
  NATIVE_TOKEN,
  WATCHED_TOKENS,
  type WatchedToken,
} from "./config.js";
import type { RawState, TokenBalance } from "./types.js";

const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * The impure I/O boundary read() depends on. Production code gets `makeViemReadDeps()`;
 * unit tests inject a mock (pure-boundary contract: "read -- impure, mock RPC in tests").
 */
export interface ReadDeps {
  getBlockNumber: () => Promise<bigint>;
  getBalance: (address: Address) => Promise<bigint>;
  readErc20Balance: (token: Address, owner: Address) => Promise<bigint>;
}

export function makeViemReadDeps(rpcUrl: string = MONAD_RPC_URL): ReadDeps {
  const client = createPublicClient({ transport: http(rpcUrl) });
  return {
    getBlockNumber: () => client.getBlockNumber(),
    getBalance: (address) => client.getBalance({ address }),
    readErc20Balance: (token, owner) =>
      client.readContract({
        address: token,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [owner],
      }),
  };
}

/**
 * readTokenBalances(tokens, wallet, deps) -> TokenBalance[]
 *
 * Reads every token's balanceOf for `wallet` concurrently (Promise.all), not
 * one at a time. Extracted so the concurrency fix (review finding: L65-73
 * previously did a sequential `await` in a for-loop over WATCHED_TOKENS) is
 * directly testable with an arbitrary token list, independent of the global
 * WATCHED_TOKENS config.
 */
export async function readTokenBalances(
  tokens: readonly WatchedToken[],
  wallet: Address,
  deps: ReadDeps,
): Promise<TokenBalance[]> {
  return Promise.all(
    tokens.map(async (token) => {
      const raw = await deps.readErc20Balance(token.address as Address, wallet);
      return {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        rawBalance: raw.toString(),
      };
    }),
  );
}

/**
 * read(wallet) -> RawState
 *
 * The only I/O seam for on-chain reads (pure-boundary contract). Reads the wallet's
 * native MON balance plus every watched ERC20 token's balanceOf, at the current
 * block -- all concurrently, not sequentially. `deps` defaults to a real
 * Monad-mainnet viem client; tests inject a mock.
 */
export async function read(
  wallet: Address,
  deps: ReadDeps = makeViemReadDeps(),
): Promise<RawState> {
  const [blockNumber, nativeBalance, tokenBalances] = await Promise.all([
    deps.getBlockNumber(),
    deps.getBalance(wallet),
    readTokenBalances(WATCHED_TOKENS, wallet, deps),
  ]);

  const balances: TokenBalance[] = [
    {
      address: NATIVE_TOKEN,
      symbol: "MON",
      decimals: 18,
      rawBalance: nativeBalance.toString(),
    },
    ...tokenBalances,
  ];

  return { wallet, blockNumber: Number(blockNumber), balances };
}

/**
 * readMany(wallets, deps) -> RawState[]
 *
 * wallet brief step 5: extends read() from one wallet (initial implementation) to the wallet SET, all
 * concurrently. Each wallet's read() is independent (no cursor applies -- a
 * balanceOf call is always "current state", not incremental history; the
 * incremental cursor + backoff layer is scanner.ts, for log/activity scans).
 */
export async function readMany(
  wallets: readonly Address[],
  deps: ReadDeps = makeViemReadDeps(),
): Promise<RawState[]> {
  return Promise.all(wallets.map((wallet) => read(wallet, deps)));
}
