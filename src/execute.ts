import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BATCH_EXECUTOR_ABI } from "./abi.js";
import { monad } from "./chains.js";
import { MONAD_RPC_URL } from "./config.js";

export interface Action {
  target: Address;
  data: Hex;
}

/** The one calldata payload prepared for human approval (product spec: prepare() -> ProposedAction). */
export interface ProposedAction {
  /** The deployed BatchExecutor singleton the wallet delegates to via EIP-7702. */
  implementationAddress: Address;
  approvalDigest: Hex;
  actions: Action[];
  /**
   * True iff `actions.length > 0` (review hardening: type-level no-op signal).
   * Set by prepare() so a caller (the web UI's approve button, orchestration)
   * can check this BEFORE ever calling execute() -- never discover an empty
   * batch only when BatchExecutor's `EmptyBatch` guard reverts on submission.
   * execute() also re-checks this at runtime (defense in depth) in case a
   * caller ignores the type-level signal.
   */
  hasActions: boolean;
}

/** A real, submitted-and-mined transaction result. */
export interface TxReceipt {
  kind: "executed";
  txHash: Hex;
  success: boolean;
  blockNumber: number;
}

/**
 * review hardening: execute()'s early-return for a `ProposedAction` with zero
 * actions -- never submits `executeBatch([], ...)`, which BatchExecutor's own
 * `EmptyBatch` guard would revert on. "Nothing to revoke this run" is a valid,
 * non-error outcome (see prepare.ts), so this is a distinct result shape, not
 * a thrown error.
 */
export interface NoOpResult {
  kind: "noop";
  reason: string;
}

/** execute()'s return type -- discriminate on `.kind` before reading
 * `TxReceipt`-only fields (`txHash`/`success`/`blockNumber`). */
export type ExecuteResult = TxReceipt | NoOpResult;

/**
 * The impure I/O boundary execute() depends on -- viem's signAuthorization / writeContract /
 * waitForTransactionReceipt, narrowed to exactly what execute() calls so unit tests can
 * inject a mock without a live RPC (pure-boundary contract: "execute -- impure, only onchain seam").
 */
export interface ExecuteClients {
  /** Returns viem's signed EIP-7702 authorization object -- opaque here, forwarded
   * verbatim into writeContract's `authorizationList`. */
  signAuthorization: (params: {
    contractAddress: Address;
    executor?: "self";
  }) => Promise<unknown>;
  writeContract: (params: Record<string, unknown>) => Promise<Hex>;
  waitForTransactionReceipt: (params: {
    hash: Hex;
  }) => Promise<{ status: "success" | "reverted"; blockNumber: bigint }>;
}

export function makeViemExecuteClients(
  walletPrivateKey: Hex,
  rpcUrl: string = MONAD_RPC_URL,
): { walletAddress: Address; clients: ExecuteClients } {
  const account = privateKeyToAccount(walletPrivateKey);
  const transport = http(rpcUrl);
  const walletClient = createWalletClient({ account, chain: monad, transport });
  const publicClient = createPublicClient({ chain: monad, transport });

  return {
    walletAddress: account.address,
    clients: {
      signAuthorization: (params) =>
        walletClient.signAuthorization(params as never),
      writeContract: (params) => walletClient.writeContract(params as never),
      waitForTransactionReceipt: (params) =>
        publicClient.waitForTransactionReceipt(params),
    },
  };
}

/**
 * execute(ProposedAction, humanApproval) -> ExecuteResult
 *
 * The only impure/onchain seam (pure-boundary contract). `humanApproval` here is the
 * caller having already confirmed the action -- CLI confirm for the demo, the web approve
 * web button -- `execute()` itself just submits the one approved batch-revoke call.
 *
 * review hardening: if `proposed.hasActions` is false (or, defensively,
 * `actions.length === 0`), returns a `NoOpResult` immediately -- no
 * signAuthorization, no writeContract, no network call at all. BatchExecutor's
 * own `EmptyBatch` guard would revert an `executeBatch([], ...)` call; this
 * guard means a caller (the web UI, orchestration) can never accidentally submit
 * that doomed transaction, even if it ignores the type-level `hasActions` signal.
 *
 * Otherwise: signs an EIP-7702 authorization delegating `walletAddress` to the
 * BatchExecutor implementation, then submits `executeBatch` to the wallet's own
 * address (so `msg.sender == address(this)` inside the contract, satisfying its
 * self-only check).
 */
export async function execute(
  proposed: ProposedAction,
  walletAddress: Address,
  clients: ExecuteClients,
): Promise<ExecuteResult> {
  if (!proposed.hasActions || proposed.actions.length === 0) {
    return {
      kind: "noop",
      reason:
        "ProposedAction has zero actions -- nothing to revoke this run, never submitted to BatchExecutor.",
    };
  }

  // `executor: "self"` tells viem the same account both signs the authorization and
  // sends the transaction, so it applies the required nonce+1 offset (EIP-7702:
  // the authority's nonce is checked *after* the transaction's own nonce increments
  // when authority === tx.sender). Omitting this causes the authorization to be
  // signed against the wrong nonce and silently skipped by the node.
  const authorization = await clients.signAuthorization({
    contractAddress: proposed.implementationAddress,
    executor: "self",
  });

  const txHash = await clients.writeContract({
    address: walletAddress,
    abi: BATCH_EXECUTOR_ABI,
    functionName: "executeBatch",
    args: [proposed.approvalDigest, proposed.actions],
    authorizationList: [authorization],
  });

  const receipt = await clients.waitForTransactionReceipt({ hash: txHash });
  return {
    kind: "executed",
    txHash,
    success: receipt.status === "success",
    blockNumber: Number(receipt.blockNumber),
  };
}
