import {
  createPublicClient,
  getAddress,
  http,
  pad,
  type Address,
  type Hex,
} from "viem";
import { APPROVAL_EVENT_TOPIC } from "./anomalies.js";
import { MONAD_RPC_URL } from "./config.js";

const HYPERSYNC_URL = "https://monad.hypersync.xyz";
const MULTICALL3_ADDRESS =
  "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;
const MAX_PAGES = 32;

const ERC20_INSPECTION_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export interface HypersyncApprovalLog {
  address: Address;
  topic0: Hex;
  topic1?: Hex | null;
  topic2?: Hex | null;
  topic3?: Hex | null;
  data: Hex;
  block_number: number;
  transaction_hash: Hex;
  log_index: number;
}

export interface ApprovalQueryPage {
  archiveHeight: number;
  nextBlock: number;
  logs: HypersyncApprovalLog[];
}

export interface ApprovalCandidate {
  token: Address;
  spender: Address;
  eventValue: bigint;
  blockNumber: number;
  transactionHash: Hex;
  logIndex: number;
}

export interface CurrentAllowance {
  candidate: ApprovalCandidate;
  allowance: bigint;
  symbol?: string;
  decimals?: number;
}

export interface ActiveApproval {
  owner: Address;
  token: Address;
  spender: Address;
  allowance: string;
  symbol?: string;
  decimals?: number;
  blockNumber: number;
  transactionHash: Hex;
}

export interface IndexedApprovalDeps {
  queryPage: (owner: Address, fromBlock: number) => Promise<ApprovalQueryPage>;
  readCurrentAllowances: (
    owner: Address,
    candidates: readonly ApprovalCandidate[],
  ) => Promise<CurrentAllowance[]>;
}

interface HypersyncQueryResponse {
  archive_height?: number | null;
  next_block?: number;
  data?: Array<{ logs?: HypersyncApprovalLog[] }>;
}

export function parseApprovalQueryResponse(
  body: HypersyncQueryResponse,
): ApprovalQueryPage {
  if (!Number.isSafeInteger(body.next_block)) {
    throw new Error("HyperSync response did not include next_block.");
  }

  return {
    archiveHeight: Number(body.archive_height ?? body.next_block),
    nextBlock: Number(body.next_block),
    logs: body.data?.flatMap((chunk) => chunk.logs ?? []) ?? [],
  };
}

export function buildApprovalQuery(owner: Address, fromBlock: number) {
  return {
    from_block: fromBlock,
    logs: [
      {
        topics: [
          [APPROVAL_EVENT_TOPIC],
          [pad(owner, { size: 32 }).toLowerCase() as Hex],
        ],
      },
    ],
    field_selection: {
      log: [
        "address",
        "topic0",
        "topic1",
        "topic2",
        "topic3",
        "data",
        "block_number",
        "transaction_hash",
        "log_index",
      ],
    },
  };
}

export function makeIndexedApprovalDeps(
  bearerToken: string | undefined = process.env.HYPERSYNC_BEARER_TOKEN,
  rpcUrl: string = MONAD_RPC_URL,
): IndexedApprovalDeps {
  const client = createPublicClient({ transport: http(rpcUrl) });

  return {
    queryPage: async (owner, fromBlock) => {
      if (!bearerToken) {
        throw new Error(
          "Indexed approval source is not configured. Set HYPERSYNC_BEARER_TOKEN.",
        );
      }

      const response = await fetch(`${HYPERSYNC_URL}/query`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(buildApprovalQuery(owner, fromBlock)),
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        throw new Error(`HyperSync approval query failed (${response.status}).`);
      }

      return parseApprovalQueryResponse(
        (await response.json()) as HypersyncQueryResponse,
      );
    },
    readCurrentAllowances: async (owner, candidates) => {
      if (candidates.length === 0) return [];

      const contracts = candidates.flatMap((candidate) => [
        {
          address: candidate.token,
          abi: ERC20_INSPECTION_ABI,
          functionName: "allowance" as const,
          args: [owner, candidate.spender] as const,
        },
        {
          address: candidate.token,
          abi: ERC20_INSPECTION_ABI,
          functionName: "symbol" as const,
          args: [] as const,
        },
        {
          address: candidate.token,
          abi: ERC20_INSPECTION_ABI,
          functionName: "decimals" as const,
          args: [] as const,
        },
      ]);

      const results = await client.multicall({
        allowFailure: true,
        contracts,
        multicallAddress: MULTICALL3_ADDRESS,
      });

      return candidates.map((candidate, index) => {
        const allowanceResult = results[index * 3];
        const symbolResult = results[index * 3 + 1];
        const decimalsResult = results[index * 3 + 2];
        return {
          candidate,
          allowance:
            allowanceResult?.status === "success" &&
            typeof allowanceResult.result === "bigint"
              ? allowanceResult.result
              : 0n,
          symbol:
            symbolResult?.status === "success" &&
            typeof symbolResult.result === "string"
              ? symbolResult.result
              : undefined,
          decimals:
            decimalsResult?.status === "success" &&
            typeof decimalsResult.result === "number"
              ? decimalsResult.result
              : undefined,
        };
      });
    },
  };
}

export async function discoverActiveApprovals(
  owner: Address,
  deps: IndexedApprovalDeps = makeIndexedApprovalDeps(),
): Promise<ActiveApproval[]> {
  const latestByPair = new Map<string, ApprovalCandidate>();
  let fromBlock = 0;

  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    const page = await deps.queryPage(owner, fromBlock);
    for (const log of page.logs) {
      const candidate = parseErc20Approval(log);
      if (!candidate) continue;
      const key = `${candidate.token.toLowerCase()}:${candidate.spender.toLowerCase()}`;
      const existing = latestByPair.get(key);
      if (!existing || isLater(candidate, existing)) {
        latestByPair.set(key, candidate);
      }
    }

    if (page.nextBlock >= page.archiveHeight) break;
    if (page.nextBlock <= fromBlock) {
      throw new Error("HyperSync pagination did not advance.");
    }
    fromBlock = page.nextBlock;

    if (pageNumber === MAX_PAGES - 1) {
      throw new Error(`HyperSync approval query exceeded ${MAX_PAGES} pages.`);
    }
  }

  const candidates = [...latestByPair.values()].filter(
    (candidate) => candidate.eventValue > 0n,
  );
  if (candidates.length === 0) return [];

  const current = await deps.readCurrentAllowances(owner, candidates);
  return current
    .filter((item) => item.allowance > 0n)
    .map((item) => ({
      owner,
      token: item.candidate.token,
      spender: item.candidate.spender,
      allowance: item.allowance.toString(),
      symbol: item.symbol,
      decimals: item.decimals,
      blockNumber: item.candidate.blockNumber,
      transactionHash: item.candidate.transactionHash,
    }));
}

function parseErc20Approval(
  log: HypersyncApprovalLog,
): ApprovalCandidate | undefined {
  if (
    log.topic0?.toLowerCase() !== APPROVAL_EVENT_TOPIC.toLowerCase() ||
    !log.topic1 ||
    !log.topic2 ||
    log.topic3 ||
    !/^0x[0-9a-fA-F]{64}$/.test(log.data)
  ) {
    return undefined;
  }

  return {
    token: getAddress(log.address),
    spender: getAddress(`0x${log.topic2.slice(-40)}`),
    eventValue: BigInt(log.data),
    blockNumber: log.block_number,
    transactionHash: log.transaction_hash,
    logIndex: log.log_index,
  };
}

function isLater(a: ApprovalCandidate, b: ApprovalCandidate): boolean {
  return (
    a.blockNumber > b.blockNumber ||
    (a.blockNumber === b.blockNumber && a.logIndex > b.logIndex)
  );
}
