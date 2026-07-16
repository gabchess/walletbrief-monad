import { describe, expect, it } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { prepare } from "../src/prepare.js";
import { ERC20_APPROVE_ABI } from "../src/abi.js";
import type { Anomaly } from "../src/anomalies.js";
import type { PnLReport } from "../src/types.js";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const IMPLEMENTATION = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const TOKEN_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const SPENDER_1 = "0xc1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1" as Address;
const SPENDER_2 = "0xc2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2" as Address;

function emptyPnl(): PnLReport {
  return {
    wallet: WALLET,
    isBaseline: false,
    tokens: [],
    usdValueChangeCents: 0,
  };
}

function staleApproval(
  token: Address,
  spender: Address,
  allowance: string,
  blockNumber: number,
): Anomaly {
  return { type: "stale-approval", token, spender, allowance, blockNumber };
}

describe("prepare(anomalies, pnlReport, implementationAddress) -> ProposedAction (implementation, pure)", () => {
  it("builds one approve(spender, 0) revoke action per stale approval", () => {
    const anomalies: Anomaly[] = [
      staleApproval(TOKEN_A, SPENDER_1, "1000", 100),
      staleApproval(TOKEN_B, SPENDER_2, "2000", 200),
    ];
    const proposed = prepare(anomalies, emptyPnl(), IMPLEMENTATION);

    expect(proposed.implementationAddress).toBe(IMPLEMENTATION);
    expect(proposed.actions).toHaveLength(2);
    expect(proposed.hasActions).toBe(true);

    const targets = proposed.actions.map((a) => a.target.toLowerCase()).sort();
    expect(targets).toEqual(
      [TOKEN_A.toLowerCase(), TOKEN_B.toLowerCase()].sort(),
    );

    for (const action of proposed.actions) {
      const decoded = decodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        data: action.data,
      });
      expect(decoded.functionName).toBe("approve");
      expect(decoded.args[1]).toBe(0n); // revoke to zero, never a nonzero amount
    }
  });

  it("targets EXACTLY the approved spender for each revoke, not a mismatched one", () => {
    const anomalies: Anomaly[] = [
      staleApproval(TOKEN_A, SPENDER_1, "1000", 100),
      staleApproval(TOKEN_B, SPENDER_2, "2000", 200),
    ];
    const proposed = prepare(anomalies, emptyPnl(), IMPLEMENTATION);

    const bySpender = new Map(
      proposed.actions.map((action) => {
        const decoded = decodeFunctionData({
          abi: ERC20_APPROVE_ABI,
          data: action.data,
        });
        return [
          action.target.toLowerCase(),
          (decoded.args[0] as string).toLowerCase(),
        ];
      }),
    );
    expect(bySpender.get(TOKEN_A.toLowerCase())).toBe(SPENDER_1.toLowerCase());
    expect(bySpender.get(TOKEN_B.toLowerCase())).toBe(SPENDER_2.toLowerCase());
  });

  it("ignores non-stale-approval anomalies (new-approval, failed-tx, balance-drift are informational only)", () => {
    const anomalies: Anomaly[] = [
      {
        type: "new-approval",
        token: TOKEN_A,
        spender: SPENDER_1,
        allowance: "1",
        blockNumber: 1,
      },
      { type: "failed-tx", transactionHash: "0xdead", blockNumber: 1 },
      {
        type: "balance-drift",
        address: "native",
        symbol: "MON",
        amountChange: "1",
        usdValueChangeCents: 500,
      },
    ];
    const proposed = prepare(anomalies, emptyPnl(), IMPLEMENTATION);
    expect(proposed.actions).toEqual([]);
  });

  it("returns a well-formed no-op ProposedAction when there are no stale approvals (not an error)", () => {
    const proposed = prepare([], emptyPnl(), IMPLEMENTATION);
    expect(proposed.implementationAddress).toBe(IMPLEMENTATION);
    expect(proposed.actions).toEqual([]);
    expect(proposed.approvalDigest).toMatch(/^0x[0-9a-f]{64}$/);
    // review hardening: hasActions is the type-level no-op signal callers check
    // BEFORE calling execute() -- never discover an empty batch only when
    // BatchExecutor's EmptyBatch guard reverts on submission.
    expect(proposed.hasActions).toBe(false);
  });

  it("produces a deterministic digest for the same wallet + stale set, and a different digest for a different set", () => {
    const anomaliesA: Anomaly[] = [
      staleApproval(TOKEN_A, SPENDER_1, "1000", 100),
    ];
    const anomaliesB: Anomaly[] = [
      staleApproval(TOKEN_A, SPENDER_1, "1000", 999),
    ]; // different sinceBlock

    const pnl: PnLReport = {
      wallet: WALLET,
      isBaseline: false,
      tokens: [],
      usdValueChangeCents: 0,
    };

    const proposed1 = prepare(anomaliesA, pnl, IMPLEMENTATION);
    const proposed2 = prepare(anomaliesA, pnl, IMPLEMENTATION);
    const proposed3 = prepare(anomaliesB, pnl, IMPLEMENTATION);

    expect(proposed1.approvalDigest).toBe(proposed2.approvalDigest);
    expect(proposed1.approvalDigest).not.toBe(proposed3.approvalDigest);
  });
});
