import type { Address } from "viem";
import { readJsonFile, writeJsonFile } from "./json-file-store.js";

/**
 * Persisted per-wallet last-scanned-block cursor. scanner.ts reads the cursor
 * before a scan, then advances and persists
 * it only after that window's getLogs call succeeds.
 */
export interface CursorStore {
  getCursor(wallet: Address): Promise<number | undefined>;
  setCursor(wallet: Address, block: number): Promise<void>;
}

type CursorData = Record<string, number>;

/**
 * File-based JSON cursor store.
 *
 * ponytail: a JSON file is plenty for the wallet-set sizes this project targets
 * (single-digit to low-hundreds of watched wallets, one write per scan window).
 * Upgrade path: sqlite if the wallet set or write frequency ever outgrows a
 * single JSON file's read-modify-write safety.
 */
export class FileCursorStore implements CursorStore {
  constructor(private readonly filePath: string) {}

  async getCursor(wallet: Address): Promise<number | undefined> {
    const data = await readJsonFile<CursorData>(this.filePath, {});
    return data[wallet.toLowerCase()];
  }

  async setCursor(wallet: Address, block: number): Promise<void> {
    const data = await readJsonFile<CursorData>(this.filePath, {});
    data[wallet.toLowerCase()] = block;
    await writeJsonFile(this.filePath, data);
  }
}
