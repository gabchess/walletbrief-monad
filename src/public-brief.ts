import { createPublicClient, http, type Address } from "viem";
import { MONAD_RPC_URL, WATCHED_TOKENS } from "./config.js";

const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const WMON_ADDRESS = WATCHED_TOKENS[0]!.address as Address;

export interface PublicBriefDeps {
  getBlockNumber: () => Promise<bigint>;
  getBalance: (address: Address) => Promise<bigint>;
  getTransactionCount: (address: Address) => Promise<number>;
  getWmonBalance: (address: Address) => Promise<bigint>;
  now: () => number;
}

export interface PublicWalletBrief {
  address: Address;
  blockNumber: number;
  nativeBalance: string;
  transactionCount: number;
  wmonBalance: string;
  durationMs: number;
}

export function makePublicBriefDeps(
  rpcUrl: string = MONAD_RPC_URL,
): PublicBriefDeps {
  const client = createPublicClient({ transport: http(rpcUrl) });
  return {
    getBlockNumber: () => client.getBlockNumber(),
    getBalance: (address) => client.getBalance({ address }),
    getTransactionCount: (address) => client.getTransactionCount({ address }),
    getWmonBalance: (address) =>
      client.readContract({
        address: WMON_ADDRESS,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [address],
      }),
    now: Date.now,
  };
}

export async function loadPublicBrief(
  address: Address,
  deps: PublicBriefDeps = makePublicBriefDeps(),
): Promise<PublicWalletBrief> {
  const startedAt = deps.now();
  const [blockNumber, nativeBalance, transactionCount, wmonBalance] =
    await Promise.all([
      deps.getBlockNumber(),
      deps.getBalance(address),
      deps.getTransactionCount(address),
      deps.getWmonBalance(address),
    ]);

  return {
    address,
    blockNumber: Number(blockNumber),
    nativeBalance: nativeBalance.toString(),
    transactionCount,
    wmonBalance: wmonBalance.toString(),
    durationMs: deps.now() - startedAt,
  };
}
