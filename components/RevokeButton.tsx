"use client";

import { useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import type { ActiveApproval } from "../src/indexed-approvals.js";
import { monad } from "../src/chains.js";
import {
  ERC20_APPROVE_ABI,
  revokeApproval,
  type RevokeDeps,
} from "../src/revoke.js";
import { transactionExplorerUrl } from "../src/explorer.js";

type InjectedProvider = EIP1193Provider & {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
};

export function RevokeButton({ approval }: { approval: ActiveApproval }) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "pending"; message: string }
    | { kind: "error"; message: string }
    | { kind: "done"; hash: Hex }
  >({ kind: "idle" });

  async function onRevoke() {
    try {
      const provider = window.ethereum as InjectedProvider | undefined;
      if (!provider) {
        throw new Error("Install or open an EVM wallet to revoke this approval.");
      }

      setStatus({ kind: "pending", message: "Connecting wallet…" });
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];
      const owner = accounts[0] ? getAddress(accounts[0]) : undefined;
      if (!owner) throw new Error("No wallet account was returned.");

      await ensureMonad(provider);
      setStatus({ kind: "pending", message: "Simulating revoke…" });

      const publicClient = createPublicClient({ chain: monad, transport: http() });
      const walletClient = createWalletClient({
        chain: monad,
        transport: custom(provider),
      });
      type Prepared = Parameters<typeof walletClient.writeContract>[0];
      const deps: RevokeDeps<Prepared> = {
        simulate: async (request) => {
          const simulated = await publicClient.simulateContract({
            account: request.account,
            address: request.token,
            abi: ERC20_APPROVE_ABI,
            functionName: "approve",
            args: [request.spender, request.amount],
          });
          return { request: simulated.request as Prepared };
        },
        write: (request) => walletClient.writeContract(request),
      };

      const hash = await revokeApproval(approval, owner, deps);
      setStatus({ kind: "done", hash });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Revoke failed.",
      });
    }
  }

  return (
    <div className="revoke-control">
      <button
        className="secondary-button"
        type="button"
        onClick={onRevoke}
        disabled={status.kind === "pending" || status.kind === "done"}
      >
        {status.kind === "pending" ? status.message : "Revoke approval"}
      </button>
      {status.kind === "error" && (
        <p className="inline-error" role="alert">{status.message}</p>
      )}
      {status.kind === "done" && (
        <a
          className="transaction-link"
          href={transactionExplorerUrl(status.hash)}
          target="_blank"
          rel="noreferrer"
        >
          Revoke submitted ↗
        </a>
      )}
    </div>
  );
}

async function ensureMonad(provider: InjectedProvider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x8f" }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x8f",
          chainName: "Monad Mainnet",
          nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
          rpcUrls: [monad.rpcUrls.default.http[0]],
          blockExplorerUrls: ["https://monadvision.com"],
        },
      ],
    });
  }
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}
