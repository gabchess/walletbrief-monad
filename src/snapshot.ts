import type { Address } from "viem";
import { readJsonFile, writeJsonFile } from "./json-file-store.js";
import type { ValuedState } from "./types.js";

/**
 * Persisted last-valued ValuedState per wallet. This is what
 * diff() (pnl.ts) diffs the next valuation against -- same ponytail pattern as
 * cursor.ts's FileCursorStore (initial implementation): a gitignored JSON file, read-modify-write.
 */
export interface SnapshotStore {
  getSnapshot(wallet: Address): Promise<ValuedState | undefined>;
  setSnapshot(wallet: Address, snapshot: ValuedState): Promise<void>;
}

type SnapshotData = Record<string, ValuedState>;

/**
 * File-based JSON snapshot store.
 *
 * ponytail: a JSON file mirrors FileCursorStore's proven-adequate approach for
 * this project's wallet-set sizes. Upgrade path: sqlite if the wallet set or
 * write frequency ever outgrows a single JSON file's read-modify-write safety.
 */
export class FileSnapshotStore implements SnapshotStore {
  constructor(private readonly filePath: string) {}

  async getSnapshot(wallet: Address): Promise<ValuedState | undefined> {
    const data = await readJsonFile<SnapshotData>(this.filePath, {});
    return data[wallet.toLowerCase()];
  }

  async setSnapshot(wallet: Address, snapshot: ValuedState): Promise<void> {
    const data = await readJsonFile<SnapshotData>(this.filePath, {});
    data[wallet.toLowerCase()] = snapshot;
    await writeJsonFile(this.filePath, data);
  }
}
