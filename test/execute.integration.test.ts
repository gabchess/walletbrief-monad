import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { defineChain } from "viem";
import {
  execute,
  makeViemExecuteClients,
  type ProposedAction,
} from "../src/execute.js";
import { BATCH_EXECUTOR_ABI } from "../src/abi.js";

// Local Anvil fork only, never real mainnet. Skipped by default so `npm test`
// stays green without Anvil or Forge; opt in with `npm run test:integration`.
const RUN = process.env.RUN_ANVIL_INTEGRATION === "1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, "..", "contracts");
const PORT = 8555;
const RPC_URL = `http://127.0.0.1:${PORT}`;
const ANVIL_CONFIG_PATH = `/tmp/walletbrief-anvil-${process.pid}.json`;

// An ephemeral account is funded by this test's Anvil process. No reusable
// development key is kept in the repository.
let WALLET_PK: Hex;
let WALLET: PrivateKeyAccount;
const SPENDER: Address = "0x000000000000000000000000000000000000beef";

const localAnvilMonad = defineChain({
  id: 143,
  name: "Monad (local anvil fork)",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

describe.skipIf(!RUN)(
  "execute() against a local anvil fork of Monad mainnet",
  () => {
    let anvil: ChildProcess;
    let implementationAddress: Address;
    let tokenAddress: Address;

    beforeAll(async () => {
      anvil = spawn(
        "anvil",
        [
          "--fork-url",
          process.env.MONAD_RPC_URL ?? "https://rpc.monad.xyz",
          "--chain-id",
          "143",
          "--port",
          String(PORT),
          "--mnemonic-random",
          "12",
          "--config-out",
          ANVIL_CONFIG_PATH,
        ],
        { stdio: "ignore" },
      );
      await waitForRpc(RPC_URL);
      const anvilConfig = JSON.parse(
        readFileSync(ANVIL_CONFIG_PATH, "utf8"),
      ) as { private_keys?: string[] };
      const firstKey = anvilConfig.private_keys?.[0];
      if (!/^0x[0-9a-fA-F]{64}$/.test(firstKey ?? "")) {
        throw new Error("Anvil did not provide an ephemeral test account.");
      }
      WALLET_PK = firstKey as Hex;
      WALLET = privateKeyToAccount(WALLET_PK);

      // forge build artifacts must exist (contracts/out/*) -- `forge build` is idempotent/cached.
      execFileSync("forge", ["build"], { cwd: CONTRACTS_DIR, stdio: "ignore" });

      implementationAddress = deployViaForge(
        "src/BatchExecutor.sol:BatchExecutor",
        [],
      );
      tokenAddress = deployViaForge("test/mocks/MockERC20.sol:MockERC20", [
        "Test Token",
        "TT",
      ]);
    }, 60_000);

    afterAll(() => {
      anvil?.kill();
      rmSync(ANVIL_CONFIG_PATH, { force: true });
    });

    it("revokes a stale approval end to end and rejects a replayed digest", async () => {
      const publicClient = createPublicClient({
        chain: localAnvilMonad,
        transport: http(RPC_URL),
      });
      const walletClient = createWalletClient({
        account: WALLET,
        chain: localAnvilMonad,
        transport: http(RPC_URL),
      });

      const erc20Abi = [
        {
          type: "function",
          name: "mint",
          stateMutability: "nonpayable",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [],
        },
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
      ] as const;

      // Mint + create the stale approval (WALLET approves SPENDER for max, never draws down).
      await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "mint",
        args: [WALLET.address, 1_000n * 10n ** 18n],
      });
      const approveHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [SPENDER, 2n ** 256n - 1n],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const staleAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [WALLET.address, SPENDER],
      });
      expect(staleAllowance).toBe(2n ** 256n - 1n);

      // Build the ProposedAction: one revoke call, through our real TS execute() seam.
      const proposed: ProposedAction = {
        implementationAddress,
        approvalDigest:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        actions: [
          {
            target: tokenAddress,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [SPENDER, 0n],
            }),
          },
        ],
        hasActions: true,
      };

      const { walletAddress, clients } = makeViemExecuteClients(
        WALLET_PK,
        RPC_URL,
      );
      const receipt = await execute(proposed, walletAddress, clients);

      expect(receipt.kind).toBe("executed");
      if (receipt.kind !== "executed") throw new Error("unreachable");
      expect(receipt.success).toBe(true);

      const finalAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [WALLET.address, SPENDER],
      });
      expect(finalAllowance).toBe(0n);

      const txReceipt = await publicClient.getTransactionReceipt({
        hash: receipt.txHash,
      });
      const events = parseEventLogs({
        abi: BATCH_EXECUTOR_ABI,
        logs: txReceipt.logs,
      });
      expect(events.some((e) => e.eventName === "BatchExecuted")).toBe(true);
      const actionResult = events.find((e) => e.eventName === "ActionResult");
      expect(actionResult).toBeDefined();
      expect(
        (actionResult as { args: { success: boolean } }).args.success,
      ).toBe(true);

      // Replay: same digest again must fail (either throws at simulation time or the
      // receipt itself reports failure -- both are acceptable proof of replay-protection).
      let replaySucceeded = true;
      try {
        const replayReceipt = await execute(proposed, walletAddress, clients);
        replaySucceeded =
          replayReceipt.kind === "executed" && replayReceipt.success;
      } catch {
        replaySucceeded = false;
      }
      expect(replaySucceeded).toBe(false);
    }, 30_000);
  },
);

function deployViaForge(
  contractRef: string,
  constructorArgs: string[],
): Address {
  const args = [
    "create",
    "--rpc-url",
    RPC_URL,
    "--private-key",
    WALLET_PK,
    "--broadcast",
    "--json",
    contractRef,
  ];
  if (constructorArgs.length > 0) {
    args.push("--constructor-args", ...constructorArgs);
  }
  const out = execFileSync("forge", args, { cwd: CONTRACTS_DIR }).toString();
  const parsed = JSON.parse(out) as { deployedTo: Address };
  return parsed.deployedTo;
}

async function waitForRpc(url: string, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`anvil did not become ready at ${url} within ${timeoutMs}ms`);
}
