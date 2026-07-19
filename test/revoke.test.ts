import { describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import {
  prepareRevoke,
  revokeApproval,
  type RevokeDeps,
} from "../src/revoke.js";
import type { ActiveApproval } from "../src/indexed-approvals.js";

const OWNER = "0x35160A4238CB5F3166046399c397B6E0c12FD872" as Address;
const OTHER = "0x0000000000000000000000000000000000000001" as Address;
const APPROVAL: ActiveApproval = {
  owner: OWNER,
  token: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  spender: "0x000000000000000000000000000000000000dEaD",
  allowance: "10",
  symbol: "WMON",
  decimals: 18,
  blockNumber: 1,
  transactionHash: `0x${"ab".repeat(32)}` as Hex,
};

function deps(): RevokeDeps {
  return {
    simulate: vi.fn().mockResolvedValue({ request: { exact: true } }),
    write: vi.fn().mockResolvedValue(`0x${"cd".repeat(32)}`),
  };
}

describe("revokeApproval", () => {
  it("rejects a connected account that does not own the allowance", async () => {
    const mock = deps();

    await expect(prepareRevoke(APPROVAL, OTHER, mock)).rejects.toThrow(
      "Connect the wallet that owns this approval.",
    );
    expect(mock.simulate).not.toHaveBeenCalled();
  });

  it("simulates the exact zero-allowance call before requesting a write", async () => {
    const mock = deps();

    await revokeApproval(APPROVAL, OWNER, mock);

    expect(mock.simulate).toHaveBeenCalledWith({
      account: OWNER,
      token: APPROVAL.token,
      spender: APPROVAL.spender,
      amount: 0n,
    });
    expect(mock.write).toHaveBeenCalledWith({ exact: true });
    expect(vi.mocked(mock.simulate).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(mock.write).mock.invocationCallOrder[0]!,
    );
  });

  it("never requests a wallet write when simulation fails", async () => {
    const mock = deps();
    vi.mocked(mock.simulate).mockRejectedValue(new Error("simulation reverted"));

    await expect(revokeApproval(APPROVAL, OWNER, mock)).rejects.toThrow(
      "simulation reverted",
    );
    expect(mock.write).not.toHaveBeenCalled();
  });
});
