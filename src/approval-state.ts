import type { Address } from "viem";
import type { ApprovalState } from "./anomalies.js";
import { readJsonFile, writeJsonFile } from "./json-file-store.js";

/**
 * Persisted per-wallet ApprovalState (persistence rule: "use the shared store,
 * build it on the shared JsonFileStore helper"). Needed because "stale" is
 * defined cumulatively since the wallet's full scanned window began (product spec
 * Definitions), not just the current run's incremental log window --
 * detectAnomalies() (anomalies.ts) itself stays pure, threading state in/out as
 * plain values; this store is the impure persistence layer around it, mirroring
 * cursor.ts/snapshot.ts's pattern exactly.
 */
export interface ApprovalStateStore {
  getApprovalState(wallet: Address): Promise<ApprovalState | undefined>;
  setApprovalState(wallet: Address, state: ApprovalState): Promise<void>;
}

type ApprovalStateData = Record<string, ApprovalState>;

/**
 * File-based JSON approval-state store.
 *
 * ponytail: same JSON-file approach as FileCursorStore/FileSnapshotStore -- plenty
 * for this project's wallet-set sizes. Upgrade path: sqlite if that ever changes.
 */
export class FileApprovalStateStore implements ApprovalStateStore {
  constructor(private readonly filePath: string) {}

  async getApprovalState(wallet: Address): Promise<ApprovalState | undefined> {
    const data = await readJsonFile<ApprovalStateData>(this.filePath, {});
    return data[wallet.toLowerCase()];
  }

  async setApprovalState(wallet: Address, state: ApprovalState): Promise<void> {
    const data = await readJsonFile<ApprovalStateData>(this.filePath, {});
    data[wallet.toLowerCase()] = state;
    await writeJsonFile(this.filePath, data);
  }
}
