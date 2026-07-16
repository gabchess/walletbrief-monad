/** BatchExecutor ABI (contracts/src/BatchExecutor.sol). Shared between execute.ts and tests. */
export const BATCH_EXECUTOR_ABI = [
  {
    type: "function",
    name: "executeBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "approvalDigest", type: "bytes32" },
      {
        name: "actions",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "successes", type: "bool[]" }],
  },
  {
    type: "event",
    name: "BatchExecuted",
    inputs: [
      { name: "approvalDigest", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "actionCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ActionResult",
    inputs: [
      { name: "approvalDigest", type: "bytes32", indexed: true },
      { name: "index", type: "uint256", indexed: false },
      { name: "target", type: "address", indexed: false },
      { name: "success", type: "bool", indexed: false },
      { name: "returnData", type: "bytes", indexed: false },
    ],
  },
  {
    type: "error",
    name: "DigestAlreadyUsed",
    inputs: [{ name: "approvalDigest", type: "bytes32" }],
  },
  { type: "error", name: "EmptyBatch", inputs: [] },
] as const;

/** Minimal ERC20 `approve` ABI fragment -- prepare.ts's batch-revoke actions are
 * `approve(spender, 0)` calldata targeting the token (implementation). */
export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
