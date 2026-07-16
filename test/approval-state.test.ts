import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Address } from "viem";
import { FileApprovalStateStore } from "../src/approval-state.js";
import type { ApprovalState } from "../src/anomalies.js";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const WALLET_2 = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const SPENDER = "0xc1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1" as Address;

function state(allowance: string): ApprovalState {
  return {
    [`${TOKEN.toLowerCase()}:${SPENDER.toLowerCase()}`]: {
      token: TOKEN,
      spender: SPENDER,
      allowance,
      sinceBlock: 100,
      drawnDown: false,
    },
  };
}

// Implementation note carry B: "use the shared store, build it on the shared JsonFileStore
// helper" -- mirrors test/snapshot.test.ts's FileSnapshotStore suite exactly.
describe("FileApprovalStateStore -- persisted per-wallet ApprovalState", () => {
  let dir: string;
  let filePath: string;
  let store: FileApprovalStateStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "walletbrief-approval-test-"));
    filePath = path.join(dir, "approvals.json");
    store = new FileApprovalStateStore(filePath);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns undefined for a wallet with no persisted state (first run)", async () => {
    expect(await store.getApprovalState(WALLET)).toBeUndefined();
  });

  it("persists a state and returns it on the next read", async () => {
    const s = state(String(2n ** 256n - 1n));
    await store.setApprovalState(WALLET, s);
    expect(await store.getApprovalState(WALLET)).toEqual(s);
  });

  it("overwrites the prior state on a later write (not accumulate)", async () => {
    await store.setApprovalState(WALLET, state("1"));
    await store.setApprovalState(WALLET, state("2"));
    expect(await store.getApprovalState(WALLET)).toEqual(state("2"));
  });

  it("tracks state independently per wallet", async () => {
    await store.setApprovalState(WALLET, state("1"));
    await store.setApprovalState(WALLET_2, state("2"));
    expect(await store.getApprovalState(WALLET)).toEqual(state("1"));
    expect(await store.getApprovalState(WALLET_2)).toEqual(state("2"));
  });

  it("is case-insensitive on wallet address", async () => {
    await store.setApprovalState(WALLET, state("1"));
    expect(
      await store.getApprovalState(WALLET.toUpperCase() as Address),
    ).toEqual(state("1"));
  });

  it("survives across store instances reading the same file", async () => {
    await store.setApprovalState(WALLET, state("1"));
    const reopened = new FileApprovalStateStore(filePath);
    expect(await reopened.getApprovalState(WALLET)).toEqual(state("1"));
  });
});
