import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readJsonFile, writeJsonFile } from "../src/json-file-store.js";

// review finding: FileCursorStore + FileSnapshotStore had byte-identical
// read-modify-write logic. This directly tests the shared helper they (and the earlier implementation's
// approval-state store) are built on.
describe("readJsonFile/writeJsonFile -- shared JSON file-store helpers", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "walletbrief-json-store-test-"));
    filePath = path.join(dir, "data.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns the fallback when the file doesn't exist yet (first run)", async () => {
    const data = await readJsonFile<Record<string, number>>(filePath, {});
    expect(data).toEqual({});
  });

  it("round-trips a write then a read", async () => {
    await writeJsonFile(filePath, { a: 1, b: 2 });
    const data = await readJsonFile<Record<string, number>>(filePath, {});
    expect(data).toEqual({ a: 1, b: 2 });
  });

  it("creates the parent directory if it doesn't exist yet", async () => {
    const nestedPath = path.join(dir, "nested", "sub", "data.json");
    await writeJsonFile(nestedPath, { x: 1 });
    expect(await readJsonFile(nestedPath, {})).toEqual({ x: 1 });
  });

  it("overwrites on a later write (not accumulate)", async () => {
    await writeJsonFile(filePath, { a: 1 });
    await writeJsonFile(filePath, { b: 2 });
    expect(await readJsonFile(filePath, {})).toEqual({ b: 2 });
  });

  it("propagates a real parse error instead of silently returning the fallback (only ENOENT is swallowed)", async () => {
    await writeFile(filePath, "{ not valid json");
    await expect(readJsonFile(filePath, {})).rejects.toThrow();
  });
});
