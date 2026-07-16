import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Shared JSON file read/write helpers (review finding: FileCursorStore and
 * FileSnapshotStore had byte-identical read-modify-write logic, differing only in
 * their value type). Extracted here so implementation's approval-state store (and any
 * future file-backed store) reuses this instead of a third copy.
 *
 * ponytail: plain read-modify-write over a JSON file, no locking -- matches the
 * single-process invariant already documented in scanner.ts/cursor.ts. Upgrade path
 * is sqlite if the wallet set or write frequency ever outgrows this.
 */

/**
 * readJsonFile(filePath, fallback) -> T
 *
 * Returns `fallback` when the file doesn't exist yet (ENOENT) -- every existing
 * file-backed store treats "no file yet" as "no persisted state yet", not an error.
 * Any OTHER read/parse error (corrupt JSON, permissions) propagates unchanged.
 */
export async function readJsonFile<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

/** writeJsonFile(filePath, data) -- creates the parent directory if needed, then
 * overwrites the file with pretty-printed JSON. */
export async function writeJsonFile<T>(
  filePath: string,
  data: T,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2));
}
