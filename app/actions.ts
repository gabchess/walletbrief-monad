"use server";

import type { Address } from "viem";
import { approveConfiguredWallet } from "../src/approve.js";
import type { ApproveResult } from "../src/approve.js";
import { withBriefLock } from "../src/brief-lock.js";
import { getExecutionConfig } from "../src/config.js";
import { makeViemExecuteClients } from "../src/execute.js";
import { runWalletBrief } from "../src/orchestrate.js";

export type { ApproveResult } from "../src/approve.js";

export async function approveProposedAction(
  walletAddress: Address,
): Promise<ApproveResult> {
  return withBriefLock(async () => {
    let config: ReturnType<typeof getExecutionConfig>;
    try {
      config = getExecutionConfig();
    } catch (error) {
      return {
        kind: "rejected",
        reason: (error as Error).message,
      };
    }

    return approveConfiguredWallet(walletAddress, {
      configuredWallet: config.walletAddress,
      runBrief: () => runWalletBrief([config.walletAddress]),
      makeClients: () => {
        const { walletAddress: signerAddress, clients } =
          makeViemExecuteClients(config.privateKey, config.rpcUrl);
        return { signerAddress, clients };
      },
    });
  });
}
