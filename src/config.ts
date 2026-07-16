import { isAddress, type Address, type Hex } from "viem";

// Monad mainnet uses chain id 143. Canonical contract addresses come from
// https://docs.monad.xyz/developer-essentials/network-information (fetched 2026-07-14).

export const MONAD_CHAIN_ID = 143;

export const MONAD_RPC_URL =
  process.env.MONAD_RPC_URL ?? "https://rpc.monad.xyz";

export const NATIVE_TOKEN = "native";

export const DEDICATED_DEMO_WALLET =
  "0x35160A4238CB5F3166046399c397B6E0c12FD872" as Address;

export interface WatchedToken {
  address: string;
  symbol: string;
  decimals: number;
}

/**
 * The current public demo intentionally tracks only canonical WMON. Broader token
 * discovery would require a separate indexed token-universe boundary.
 */
export const WATCHED_TOKENS: WatchedToken[] = [
  {
    address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A", // Wrapped MON, canonical per docs
    symbol: "WMON",
    decimals: 18,
  },
];

/**
 * Persisted per-wallet scan-cursor JSON file. This is local scan progress,
 * not committed config --
 * see .gitignore's `.state/` entry.
 */
export const CURSOR_STORE_PATH =
  process.env.CURSOR_STORE_PATH ?? ".state/cursors.json";

/**
 * First-run seed block for scanner.ts's incremental log scan, used only when a
 * wallet has no persisted cursor yet. When unset, the scanner uses the bounded
 * SCAN_LOOKBACK_BLOCKS window instead of walking the chain's full history.
 */
function optionalNonNegativeInteger(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return value;
}

export const SCAN_START_BLOCK =
  optionalNonNegativeInteger("SCAN_START_BLOCK");

export const SCAN_LOOKBACK_BLOCKS = positiveInteger(
  "SCAN_LOOKBACK_BLOCKS",
  25_000,
);

/**
 * Persisted last-valued-snapshot JSON file, mirroring
 * CURSOR_STORE_PATH's pattern. Local scan/valuation state, not committed config --
 * see .gitignore's `.state/` entry.
 */
export const SNAPSHOT_STORE_PATH =
  process.env.SNAPSHOT_STORE_PATH ?? ".state/snapshots.json";

/**
 * Persisted per-wallet ApprovalState JSON file, mirroring
 * CURSOR_STORE_PATH/SNAPSHOT_STORE_PATH's pattern. Local approval-tracking state,
 * not committed config -- see .gitignore's `.state/` entry.
 */
export const APPROVAL_STATE_STORE_PATH =
  process.env.APPROVAL_STATE_STORE_PATH ?? ".state/approvals.json";

/**
 * Persisted per-wallet cursor for anomaly-scanner.ts's Approval/outgoing-Transfer
 * log scan. A separate cursor file from
 * CURSOR_STORE_PATH -- anomaly-scanner.ts scans different log topics over its own
 * windowing, independent of scanner.ts's incoming-transfer scan cursor (sharing one
 * cursor file across two different log-kind scans would desync: whichever scan
 * runs first would advance the shared cursor past the block range the other still
 * needs). ponytail: a second FileCursorStore instance over the same CursorStore
 * abstraction, not a refactor of scanner.ts's already-tested cursor logic.
 */
export const ANOMALY_CURSOR_STORE_PATH =
  process.env.ANOMALY_CURSOR_STORE_PATH ?? ".state/anomaly-cursors.json";

/**
 * Comma-separated wallets briefed on each run. Defaults to the dedicated public
 * demo wallet so the app starts in the narrowest supported configuration.
 */
export const BRIEF_WALLETS: string[] = (
  process.env.BRIEF_WALLETS ?? DEDICATED_DEMO_WALLET
)
  .split(",")
  .map((w) => w.trim())
  .filter((w) => w.length > 0);

/**
 * Deployed BatchExecutor implementation. The zero-address default keeps execution
 * unavailable until a verified deployment is supplied at runtime.
 */
export const BATCH_EXECUTOR_ADDRESS =
  process.env.BATCH_EXECUTOR_ADDRESS ??
  "0x0000000000000000000000000000000000000000";

function booleanFlag(name: string): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be either true or false.`);
}

export const EXECUTE_ENABLED = booleanFlag("EXECUTE_ENABLED");
export const EXECUTE_RPC_URL = process.env.EXECUTE_RPC_URL ?? MONAD_RPC_URL;
export const DEMO_EXECUTION_WALLET =
  process.env.DEMO_EXECUTION_WALLET ?? DEDICATED_DEMO_WALLET;
export const DEMO_WALLET_PRIVATE_KEY = process.env.DEMO_WALLET_PRIVATE_KEY;

export interface ExecutionConfig {
  walletAddress: Address;
  privateKey: Hex;
  rpcUrl: string;
}

export function getExecutionConfig(): ExecutionConfig {
  if (!EXECUTE_ENABLED) throw new Error("Execution is disabled.");
  if (
    !isAddress(DEMO_EXECUTION_WALLET) ||
    DEMO_EXECUTION_WALLET.toLowerCase() !==
      DEDICATED_DEMO_WALLET.toLowerCase()
  ) {
    throw new Error("DEMO_EXECUTION_WALLET must be the dedicated demo wallet.");
  }
  if (
    !isAddress(BATCH_EXECUTOR_ADDRESS) ||
    /^0x0{40}$/i.test(BATCH_EXECUTOR_ADDRESS)
  ) {
    throw new Error("BATCH_EXECUTOR_ADDRESS must be a deployed address.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(DEMO_WALLET_PRIVATE_KEY ?? "")) {
    throw new Error(
      "DEMO_WALLET_PRIVATE_KEY must be a 32-byte hex private key.",
    );
  }
  const rpc = new URL(EXECUTE_RPC_URL);
  if (rpc.protocol !== "https:") {
    throw new Error("EXECUTE_RPC_URL must use HTTPS.");
  }
  return {
    walletAddress: DEMO_EXECUTION_WALLET as Address,
    privateKey: DEMO_WALLET_PRIVATE_KEY as Hex,
    rpcUrl: EXECUTE_RPC_URL,
  };
}
