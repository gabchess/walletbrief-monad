import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileCursorStore } from "../src/cursor.js";

const WALLET = "0x000000000000000000000000000000000000dEaD" as const;
const WALLET_2 = "0x1111111111111111111111111111111111111111" as const;

// wallet brief step 2: "Cursor store: a persisted per-wallet lastScannedBlock (file-based
// JSON in a gitignored state dir -- ponytail, no DB). Read/advance/persist."
describe("FileCursorStore -- persisted per-wallet lastScannedBlock", () => {
  let dir: string;
  let filePath: string;
  let store: FileCursorStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "walletbrief-cursor-test-"));
    filePath = path.join(dir, "cursors.json");
    store = new FileCursorStore(filePath);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns undefined for a wallet with no persisted cursor (first run)", async () => {
    expect(await store.getCursor(WALLET)).toBeUndefined();
  });

  it("persists a cursor and returns it on the next read", async () => {
    await store.setCursor(WALLET, 12_345);
    expect(await store.getCursor(WALLET)).toBe(12_345);
  });

  it("advances a cursor on a later write (overwrite, not accumulate)", async () => {
    await store.setCursor(WALLET, 100);
    await store.setCursor(WALLET, 250);
    expect(await store.getCursor(WALLET)).toBe(250);
  });

  it("tracks cursors independently per wallet", async () => {
    await store.setCursor(WALLET, 100);
    await store.setCursor(WALLET_2, 200);
    expect(await store.getCursor(WALLET)).toBe(100);
    expect(await store.getCursor(WALLET_2)).toBe(200);
  });

  it("is case-insensitive on wallet address", async () => {
    await store.setCursor(WALLET, 555);
    expect(await store.getCursor(WALLET.toUpperCase() as typeof WALLET)).toBe(
      555,
    );
  });

  it("survives across store instances reading the same file (real persistence, not an in-memory cache)", async () => {
    await store.setCursor(WALLET, 999);
    const reopened = new FileCursorStore(filePath);
    expect(await reopened.getCursor(WALLET)).toBe(999);
  });

  it("creates the parent directory if it doesn't exist yet", async () => {
    const nestedPath = path.join(dir, "nested", "sub", "cursors.json");
    const nestedStore = new FileCursorStore(nestedPath);
    await nestedStore.setCursor(WALLET, 1);
    expect(await nestedStore.getCursor(WALLET)).toBe(1);
  });
});
