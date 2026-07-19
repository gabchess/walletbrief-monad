import { describe, expect, it, vi } from "vitest";
import {
  loadPublicBrief,
  type PublicBriefDeps,
} from "../src/public-brief.js";

const WALLET = "0x35160A4238CB5F3166046399c397B6E0c12FD872" as const;

function mockDeps(overrides: Partial<PublicBriefDeps> = {}): PublicBriefDeps {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(88_000_000n),
    getBalance: vi.fn().mockResolvedValue(24_000_000_000_000_000_000n),
    getTransactionCount: vi.fn().mockResolvedValue(5),
    getWmonBalance: vi.fn().mockResolvedValue(10_000_000_000_000_000n),
    now: vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_721),
    ...overrides,
  };
}

describe("loadPublicBrief", () => {
  it("returns useful live fields for the requested wallet", async () => {
    const brief = await loadPublicBrief(WALLET, mockDeps());

    expect(brief).toEqual({
      address: WALLET,
      blockNumber: 88_000_000,
      nativeBalance: "24000000000000000000",
      transactionCount: 5,
      wmonBalance: "10000000000000000",
      durationMs: 721,
    });
  });

  it("starts all independent RPC reads before any one resolves", async () => {
    const starts: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delayed = <T>(name: string, value: T) =>
      vi.fn(async () => {
        starts.push(name);
        await gate;
        return value;
      });

    const promise = loadPublicBrief(
      WALLET,
      mockDeps({
        getBlockNumber: delayed("block", 1n),
        getBalance: delayed("native", 2n),
        getTransactionCount: delayed("nonce", 3),
        getWmonBalance: delayed("wmon", 4n),
      }),
    );

    await Promise.resolve();
    expect(starts).toEqual(["block", "native", "nonce", "wmon"]);
    release();
    await promise;
  });

  it("propagates an RPC error rather than returning stale placeholder data", async () => {
    const deps = mockDeps({
      getBalance: vi.fn().mockRejectedValue(new Error("RPC unavailable")),
    });

    await expect(loadPublicBrief(WALLET, deps)).rejects.toThrow(
      "RPC unavailable",
    );
  });
});
