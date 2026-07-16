import { isAddress, type Address } from "viem";
import { execute, type ExecuteClients, type ExecuteResult } from "./execute.js";
import type { WalletBrief } from "./orchestrate.js";

export interface RejectedResult {
  kind: "rejected";
  reason: string;
}

export type ApproveResult = ExecuteResult | RejectedResult;

export interface ApproveDeps {
  configuredWallet: Address;
  runBrief: () => Promise<WalletBrief>;
  makeClients: () => {
    signerAddress: Address;
    clients: ExecuteClients;
  };
}

export async function approveConfiguredWallet(
  walletAddress: string,
  deps: ApproveDeps,
): Promise<ApproveResult> {
  if (!isAddress(walletAddress)) {
    return { kind: "rejected", reason: "walletAddress is not valid." };
  }
  if (walletAddress.toLowerCase() !== deps.configuredWallet.toLowerCase()) {
    return { kind: "rejected", reason: "walletAddress is not configured." };
  }

  const brief = await deps.runBrief();
  const actionable = brief.actionableWallet;
  if (
    !actionable ||
    actionable.wallet.toLowerCase() !== deps.configuredWallet.toLowerCase()
  ) {
    return { kind: "noop", reason: "No current revoke is available." };
  }

  const { signerAddress, clients } = deps.makeClients();
  if (signerAddress.toLowerCase() !== deps.configuredWallet.toLowerCase()) {
    return {
      kind: "rejected",
      reason: "Configured signer does not control the demo wallet.",
    };
  }

  return execute(actionable.proposedAction, deps.configuredWallet, clients);
}
