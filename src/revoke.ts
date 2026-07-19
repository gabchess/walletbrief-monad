import { getAddress, type Address, type Hex } from "viem";
import type { ActiveApproval } from "./indexed-approvals.js";

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

export interface RevokeRequest {
  account: Address;
  token: Address;
  spender: Address;
  amount: 0n;
}

export interface RevokeDeps<TPrepared = unknown> {
  simulate: (request: RevokeRequest) => Promise<{ request: TPrepared }>;
  write: (request: TPrepared) => Promise<Hex>;
}

export async function prepareRevoke<TPrepared>(
  approval: ActiveApproval,
  connectedOwner: Address,
  deps: RevokeDeps<TPrepared>,
): Promise<TPrepared> {
  if (
    getAddress(connectedOwner).toLowerCase() !== approval.owner.toLowerCase()
  ) {
    throw new Error("Connect the wallet that owns this approval.");
  }

  const simulated = await deps.simulate({
    account: getAddress(connectedOwner),
    token: getAddress(approval.token),
    spender: getAddress(approval.spender),
    amount: 0n,
  });
  return simulated.request;
}

export async function revokeApproval<TPrepared>(
  approval: ActiveApproval,
  connectedOwner: Address,
  deps: RevokeDeps<TPrepared>,
): Promise<Hex> {
  const request = await prepareRevoke(approval, connectedOwner, deps);
  return deps.write(request);
}
