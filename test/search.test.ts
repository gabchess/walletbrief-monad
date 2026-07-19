import { describe, expect, it } from "vitest";
import { parseSearchAddress } from "../src/search.js";

const WALLET = "0x35160A4238CB5F3166046399c397B6E0c12FD872";

describe("parseSearchAddress", () => {
  it("returns the checksummed form of a valid address", () => {
    expect(parseSearchAddress(WALLET.toLowerCase())).toBe(WALLET);
  });

  it("rejects malformed input with a user-facing message", () => {
    expect(() => parseSearchAddress("not-a-wallet")).toThrow(
      "Enter a valid 0x wallet address.",
    );
  });
});
