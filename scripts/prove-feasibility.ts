import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  pad,
} from "viem";
import { MONAD_RPC_URL, WATCHED_TOKENS } from "../src/config.js";
import {
  discoverActiveApprovals,
  makeIndexedApprovalDeps,
} from "../src/indexed-approvals.js";
import { loadPublicBrief } from "../src/public-brief.js";

const DEMO_WALLET = getAddress(
  "0x35160A4238CB5F3166046399c397B6E0c12FD872",
);
const SPENDER = getAddress("0x000000000000000000000000000000000000dEaD");
const TOKEN = getAddress(WATCHED_TOKENS[0]!.address);
const APPROVE_ABI = [
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

async function main() {
  const snapshot = await loadPublicBrief(DEMO_WALLET);
  if (snapshot.durationMs >= 5_000) {
    throw new Error(`Live wallet snapshot took ${snapshot.durationMs} ms.`);
  }

  const client = createPublicClient({ transport: http(MONAD_RPC_URL) });
  const simulationStartedAt = Date.now();
  await client.simulateContract({
    account: DEMO_WALLET,
    address: TOKEN,
    abi: APPROVE_ABI,
    functionName: "approve",
    args: [SPENDER, 0n],
  });
  const simulationMs = Date.now() - simulationStartedAt;

  const deps = makeIndexedApprovalDeps();
  const firstPage = await deps.queryPage(DEMO_WALLET, 0);
  const seededPairEvents = firstPage.logs.filter(
    (log) =>
      log.address.toLowerCase() === TOKEN.toLowerCase() &&
      log.topic2?.toLowerCase() ===
        pad(SPENDER, { size: 32 }).toLowerCase(),
  );
  if (seededPairEvents.length < 2) {
    throw new Error(
      `Indexed proof found ${seededPairEvents.length} seeded events; expected the grant and revoke.`,
    );
  }
  const approvals = await discoverActiveApprovals(DEMO_WALLET, deps);

  console.log(
    JSON.stringify(
      {
        snapshot: {
          address: snapshot.address,
          blockNumber: snapshot.blockNumber,
          durationMs: snapshot.durationMs,
          transactionCount: snapshot.transactionCount,
        },
        indexedApprovals: {
          source: "Envio HyperSync",
          firstPageEvents: firstPage.logs.length,
          seededPairEvents: seededPairEvents.length,
          activeApprovals: approvals.length,
          nextBlock: firstPage.nextBlock,
          archiveHeight: firstPage.archiveHeight,
        },
        revokeSimulation: {
          durationMs: simulationMs,
          calldata: encodeFunctionData({
            abi: APPROVE_ABI,
            functionName: "approve",
            args: [SPENDER, 0n],
          }),
          token: TOKEN,
          spender: SPENDER,
          amount: "0",
          sent: false,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
