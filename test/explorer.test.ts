import { describe, expect, it } from "vitest";
import {
  addressExplorerUrl,
  blockExplorerUrl,
  transactionExplorerUrl,
} from "../src/explorer.js";

describe("MonadVision explorer links", () => {
  it("builds exact mainnet evidence URLs", async () => {
    expect(
      addressExplorerUrl("0x35160A4238CB5F3166046399c397B6E0c12FD872"),
    ).toBe(
      "https://monadvision.com/address/0x35160A4238CB5F3166046399c397B6E0c12FD872",
    );
    expect(blockExplorerUrl(123n)).toBe(
      "https://monadvision.com/block/123",
    );
    const hash = `0x${"ab".repeat(32)}`;
    expect(transactionExplorerUrl(hash)).toBe(
      `https://monadvision.com/tx/${hash}`,
    );
  });

  it("rejects malformed values instead of constructing arbitrary URLs", async () => {
    expect(() => addressExplorerUrl("not-an-address")).toThrow();
    expect(() => transactionExplorerUrl("0x1234")).toThrow();
    expect(() => blockExplorerUrl(-1n)).toThrow();
  });
});
