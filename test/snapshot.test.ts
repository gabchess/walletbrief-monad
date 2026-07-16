import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileSnapshotStore } from "../src/snapshot.js";
import type { ValuedState } from "../src/types.js";

const WALLET = "0x000000000000000000000000000000000000dEaD" as const;
const WALLET_2 = "0x1111111111111111111111111111111111111111" as const;

function valuedState(wallet: string, totalUsdValueCents: number): ValuedState {
  return {
    wallet,
    blockNumber: 100,
    balances: [],
    totalUsdValueCents,
    totalUsdValue: totalUsdValueCents / 100,
  };
}

// wallet brief step 2: "Persist the last valued snapshot per wallet ... same ponytail
// pattern as the cursor store." Mirrors test/cursor.test.ts's FileCursorStore suite.
describe("FileSnapshotStore -- persisted last-valued ValuedState per wallet", () => {
  let dir: string;
  let filePath: string;
  let store: FileSnapshotStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "walletbrief-snapshot-test-"));
    filePath = path.join(dir, "snapshots.json");
    store = new FileSnapshotStore(filePath);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns undefined for a wallet with no persisted snapshot (first run)", async () => {
    expect(await store.getSnapshot(WALLET)).toBeUndefined();
  });

  it("persists a snapshot and returns it on the next read", async () => {
    const snapshot = valuedState(WALLET, 500);
    await store.setSnapshot(WALLET, snapshot);
    expect(await store.getSnapshot(WALLET)).toEqual(snapshot);
  });

  it("overwrites the prior snapshot on a later write (not accumulate)", async () => {
    await store.setSnapshot(WALLET, valuedState(WALLET, 100));
    await store.setSnapshot(WALLET, valuedState(WALLET, 250));
    expect(await store.getSnapshot(WALLET)).toEqual(valuedState(WALLET, 250));
  });

  it("tracks snapshots independently per wallet", async () => {
    await store.setSnapshot(WALLET, valuedState(WALLET, 100));
    await store.setSnapshot(WALLET_2, valuedState(WALLET_2, 200));
    expect(await store.getSnapshot(WALLET)).toEqual(valuedState(WALLET, 100));
    expect(await store.getSnapshot(WALLET_2)).toEqual(
      valuedState(WALLET_2, 200),
    );
  });

  it("is case-insensitive on wallet address", async () => {
    await store.setSnapshot(WALLET, valuedState(WALLET, 555));
    expect(
      await store.getSnapshot(WALLET.toUpperCase() as typeof WALLET),
    ).toEqual(valuedState(WALLET, 555));
  });

  it("survives across store instances reading the same file (real persistence, not an in-memory cache)", async () => {
    await store.setSnapshot(WALLET, valuedState(WALLET, 999));
    const reopened = new FileSnapshotStore(filePath);
    expect(await reopened.getSnapshot(WALLET)).toEqual(
      valuedState(WALLET, 999),
    );
  });

  it("creates the parent directory if it doesn't exist yet", async () => {
    const nestedPath = path.join(dir, "nested", "sub", "snapshots.json");
    const nestedStore = new FileSnapshotStore(nestedPath);
    await nestedStore.setSnapshot(WALLET, valuedState(WALLET, 1));
    expect(await nestedStore.getSnapshot(WALLET)).toEqual(
      valuedState(WALLET, 1),
    );
  });
});
