import { describe, expect, it, vi } from "vitest";
import {
  read,
  readMany,
  readTokenBalances,
  type ReadDeps,
} from "../src/read.js";
import { WATCHED_TOKENS } from "../src/config.js";

const WALLET = "0x000000000000000000000000000000000000dEaD" as const;
const WALLET_2 = "0x1111111111111111111111111111111111111111" as const;

function mockDeps(overrides: Partial<ReadDeps> = {}): ReadDeps {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(88_000_000n),
    getBalance: vi.fn().mockResolvedValue(1_500_000_000_000_000_000n), // 1.5 MON
    readErc20Balance: vi.fn().mockResolvedValue(2_000_000_000_000_000_000n), // 2 tokens
    ...overrides,
  };
}

describe("read(wallet, deps) -> RawState", () => {
  it("never touches the network -- uses only the injected deps (mock RPC seam)", async () => {
    const deps = mockDeps();
    await read(WALLET, deps);
    expect(deps.getBlockNumber).toHaveBeenCalledTimes(1);
    expect(deps.getBalance).toHaveBeenCalledWith(WALLET);
  });

  it("returns the wallet address and block number unchanged", async () => {
    const state = await read(WALLET, mockDeps());
    expect(state.wallet).toBe(WALLET);
    expect(state.blockNumber).toBe(88_000_000);
  });

  it("includes the native MON balance as the first entry", async () => {
    const state = await read(WALLET, mockDeps());
    expect(state.balances[0]).toEqual({
      address: "native",
      symbol: "MON",
      decimals: 18,
      rawBalance: "1500000000000000000",
    });
  });

  it("reads every watched ERC20 token's balanceOf for the wallet", async () => {
    const deps = mockDeps();
    const state = await read(WALLET, deps);

    expect(deps.readErc20Balance).toHaveBeenCalledTimes(WATCHED_TOKENS.length);
    for (const token of WATCHED_TOKENS) {
      expect(deps.readErc20Balance).toHaveBeenCalledWith(token.address, WALLET);
    }

    // native + N watched tokens
    expect(state.balances).toHaveLength(1 + WATCHED_TOKENS.length);
    const wmon = state.balances.find((b) => b.symbol === "WMON");
    expect(wmon).toEqual({
      address: WATCHED_TOKENS[0]!.address,
      symbol: "WMON",
      decimals: 18,
      rawBalance: "2000000000000000000",
    });
  });

  it("propagates a real RPC error instead of swallowing it", async () => {
    const deps = mockDeps({
      getBalance: vi.fn().mockRejectedValue(new Error("RPC timeout")),
    });
    await expect(read(WALLET, deps)).rejects.toThrow("RPC timeout");
  });
});

// review finding (wallet brief step 1): src/read.ts L65-73 did sequential `await` in
// a for-loop over WATCHED_TOKENS. Fixed to Promise.all. This tests the extracted
// helper directly (with an arbitrary 2-token list) since WATCHED_TOKENS only has one
// entry today and can't reveal concurrency on its own.
describe("readTokenBalances(tokens, wallet, deps) -- concurrent, not sequential (review finding)", () => {
  it("fires every token's readErc20Balance call before any of them resolves", async () => {
    const callOrder: string[] = [];
    const tokens = [
      { address: "0xAAA", symbol: "AAA", decimals: 18 },
      { address: "0xBBB", symbol: "BBB", decimals: 18 },
    ];
    const deps = mockDeps({
      readErc20Balance: vi.fn(async (token: string) => {
        callOrder.push(`start:${token}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push(`end:${token}`);
        return 1n;
      }),
    });

    await readTokenBalances(tokens, WALLET, deps);

    // Promise.all fires both calls before either's setTimeout resolves. A
    // sequential await-in-for-loop would produce ["start:0xAAA", "end:0xAAA"]
    // here instead -- the assertion below fails against that old code.
    expect(callOrder.slice(0, 2)).toEqual(
      expect.arrayContaining(["start:0xAAA", "start:0xBBB"]),
    );
  });

  it("still returns balances in the input token order", async () => {
    const tokens = [
      { address: "0xAAA", symbol: "AAA", decimals: 18 },
      { address: "0xBBB", symbol: "BBB", decimals: 18 },
    ];
    const deps = mockDeps({
      readErc20Balance: vi.fn().mockResolvedValue(5n),
    });

    const balances = await readTokenBalances(tokens, WALLET, deps);

    expect(balances.map((b) => b.symbol)).toEqual(["AAA", "BBB"]);
  });
});

// wallet brief step 5: "extend to the wallet SET (the first version covered one address)".
describe("readMany(wallets, deps) -> RawState[]", () => {
  it("reads every wallet's RawState", async () => {
    const deps = mockDeps();
    const states = await readMany([WALLET, WALLET_2], deps);
    expect(states).toHaveLength(2);
    expect(states[0]?.wallet).toBe(WALLET);
    expect(states[1]?.wallet).toBe(WALLET_2);
  });

  it("reads all wallets concurrently, not one at a time", async () => {
    const callOrder: string[] = [];
    const deps = mockDeps({
      getBalance: vi.fn(async (address: string) => {
        callOrder.push(`start:${address}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push(`end:${address}`);
        return 1_000_000_000_000_000_000n;
      }),
    });

    await readMany([WALLET, WALLET_2], deps);

    expect(callOrder.slice(0, 2)).toEqual(
      expect.arrayContaining([`start:${WALLET}`, `start:${WALLET_2}`]),
    );
  });

  it("propagates an error from any single wallet's read instead of swallowing it", async () => {
    const deps = mockDeps({
      getBalance: vi.fn().mockRejectedValue(new Error("RPC timeout")),
    });
    await expect(readMany([WALLET, WALLET_2], deps)).rejects.toThrow(
      "RPC timeout",
    );
  });
});
