import { describe, expect, it } from "vitest";
import { pad, toHex, type Address, type Hex } from "viem";
import {
  APPROVAL_EVENT_TOPIC,
  BALANCE_DRIFT_THRESHOLD_CENTS,
  decodeApprovalLog,
  detectAnomalies,
  type AnomalyDetectionInput,
} from "../src/anomalies.js";
import { TRANSFER_EVENT_TOPIC, type ScanLog } from "../src/scanner.js";
import type { PnLReport } from "../src/types.js";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const OTHER_OWNER = "0x9999999999999999999999999999999999999999" as Address;
const TOKEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const TOKEN_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const SPENDER_1 = "0xc1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1" as Address;
const SPENDER_2 = "0xc2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2" as Address;
const MAX_UINT256 = 2n ** 256n - 1n;

function toTopic(address: Address): Hex {
  return pad(address, { size: 32 }) as Hex;
}

function approvalLog(
  token: Address,
  owner: Address,
  spender: Address,
  value: bigint,
  blockNumber: number,
): ScanLog {
  return {
    address: token,
    topics: [APPROVAL_EVENT_TOPIC, toTopic(owner), toTopic(spender)],
    data: toHex(value, { size: 32 }),
    blockNumber: BigInt(blockNumber),
    transactionHash: toHex(blockNumber, { size: 32 }),
  };
}

function outgoingTransferLog(
  token: Address,
  from: Address,
  blockNumber: number,
): ScanLog {
  return {
    address: token,
    topics: [
      TRANSFER_EVENT_TOPIC,
      toTopic(from),
      toTopic("0xdddddddddddddddddddddddddddddddddddddddd" as Address),
    ],
    data: toHex(1n, { size: 32 }),
    blockNumber: BigInt(blockNumber),
    transactionHash: toHex(blockNumber + 1000, { size: 32 }),
  };
}

function emptyPnlReport(wallet: Address): PnLReport {
  return { wallet, isBaseline: false, tokens: [], usdValueChangeCents: 0 };
}

function baseInput(
  overrides: Partial<AnomalyDetectionInput> = {},
): AnomalyDetectionInput {
  return {
    wallet: WALLET,
    failedTxs: [],
    approvalLogs: [],
    outgoingTransferLogs: [],
    prevApprovalState: undefined,
    pnlReport: emptyPnlReport(WALLET),
    ...overrides,
  };
}

describe("decodeApprovalLog(log) -> DecodedApproval (ERC20 Approval decoding)", () => {
  it("decodes topics[1]=owner, topics[2]=spender, data=value correctly", () => {
    const log = approvalLog(TOKEN_A, WALLET, SPENDER_1, MAX_UINT256, 100);
    const decoded = decodeApprovalLog(log);
    expect(decoded.token.toLowerCase()).toBe(TOKEN_A.toLowerCase());
    expect(decoded.owner.toLowerCase()).toBe(WALLET.toLowerCase());
    expect(decoded.spender.toLowerCase()).toBe(SPENDER_1.toLowerCase());
    expect(decoded.value).toBe(MAX_UINT256.toString());
    expect(decoded.blockNumber).toBe(100);
  });

  it("throws on a log whose topic0 does not match the Approval event signature (never silently misdecodes)", () => {
    const transferShaped = outgoingTransferLog(TOKEN_A, WALLET, 1);
    expect(() => decodeApprovalLog(transferShaped)).toThrow(/topic0/i);
  });
});

describe("detectAnomalies() -- stale-approval flagging (implementation, presence-based using the presence-based product rule)", () => {
  it("flags a live non-zero approval with no drawdown as stale", () => {
    const input = baseInput({
      approvalLogs: [approvalLog(TOKEN_A, WALLET, SPENDER_1, MAX_UINT256, 100)],
    });
    const { anomalies } = detectAnomalies(input);
    const stale = anomalies.filter((a) => a.type === "stale-approval");
    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({
      type: "stale-approval",
      spender: SPENDER_1,
      allowance: MAX_UINT256.toString(),
    });
  });

  it("does NOT flag an approval that was drawn down (an outgoing transfer of the token occurred at/after the approval block)", () => {
    const input = baseInput({
      approvalLogs: [approvalLog(TOKEN_A, WALLET, SPENDER_1, 1000n, 100)],
      outgoingTransferLogs: [outgoingTransferLog(TOKEN_A, WALLET, 150)],
    });
    const { anomalies } = detectAnomalies(input);
    expect(anomalies.some((a) => a.type === "stale-approval")).toBe(false);
  });

  it("does NOT flag a revoked (set-to-0) approval", () => {
    const input = baseInput({
      approvalLogs: [
        approvalLog(TOKEN_A, WALLET, SPENDER_1, MAX_UINT256, 100),
        approvalLog(TOKEN_A, WALLET, SPENDER_1, 0n, 200),
      ],
    });
    const { anomalies } = detectAnomalies(input);
    expect(anomalies.some((a) => a.type === "stale-approval")).toBe(false);
    expect(anomalies.some((a) => a.type === "new-approval")).toBe(false);
  });

  it("IS flagged for a re-approval after a revoke (only the latest Approval event matters)", () => {
    const input = baseInput({
      approvalLogs: [
        approvalLog(TOKEN_A, WALLET, SPENDER_1, MAX_UINT256, 100), // original approval
        approvalLog(TOKEN_A, WALLET, SPENDER_1, 0n, 200), // revoke
        approvalLog(TOKEN_A, WALLET, SPENDER_1, 500n, 300), // re-approve
      ],
    });
    const { anomalies, approvalState } = detectAnomalies(input);
    const stale = anomalies.filter((a) => a.type === "stale-approval");
    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({ allowance: "500", blockNumber: 300 });
    const record =
      approvalState[`${TOKEN_A.toLowerCase()}:${SPENDER_1.toLowerCase()}`];
    expect(record?.allowance).toBe("500");
    expect(record?.sinceBlock).toBe(300);
  });

  it("a drawdown BEFORE the current approval's block does not offset it (ordering matters)", () => {
    const input = baseInput({
      // Transfer at block 50 happens before the approval at block 100 -- must not
      // count as a drawdown of an approval that didn't exist yet.
      outgoingTransferLogs: [outgoingTransferLog(TOKEN_A, WALLET, 50)],
      approvalLogs: [approvalLog(TOKEN_A, WALLET, SPENDER_1, 1000n, 100)],
    });
    const { anomalies } = detectAnomalies(input);
    expect(anomalies.some((a) => a.type === "stale-approval")).toBe(true);
  });

  it("carries forward approval state from a previous run (cumulative, not just this window's logs)", () => {
    const prevState = {
      [`${TOKEN_A.toLowerCase()}:${SPENDER_1.toLowerCase()}`]: {
        token: TOKEN_A,
        spender: SPENDER_1,
        allowance: MAX_UINT256.toString(),
        sinceBlock: 50,
        drawnDown: false,
      },
    };
    const input = baseInput({ prevApprovalState: prevState });
    const { anomalies } = detectAnomalies(input);
    const stale = anomalies.filter((a) => a.type === "stale-approval");
    expect(stale).toHaveLength(1);
    // Not re-flagged as "new" this run -- it was already known from a prior run.
    expect(anomalies.some((a) => a.type === "new-approval")).toBe(false);
  });

  it("flags a freshly observed approval as new-approval", () => {
    const input = baseInput({
      approvalLogs: [approvalLog(TOKEN_B, WALLET, SPENDER_2, 42n, 10)],
    });
    const { anomalies } = detectAnomalies(input);
    expect(anomalies.some((a) => a.type === "new-approval")).toBe(true);
  });

  it("ignores an Approval event whose owner is not the scanned wallet", () => {
    const input = baseInput({
      approvalLogs: [approvalLog(TOKEN_A, OTHER_OWNER, SPENDER_1, 1000n, 10)],
    });
    const { anomalies, approvalState } = detectAnomalies(input);
    expect(anomalies).toHaveLength(0);
    expect(Object.keys(approvalState)).toHaveLength(0);
  });

  it("counts an owner-mismatched Approval log via debug.ignoredApprovalOwnerMismatch (review hardening: never silently hide a misconfigured wallet set)", () => {
    const input = baseInput({
      approvalLogs: [
        approvalLog(TOKEN_A, OTHER_OWNER, SPENDER_1, 1000n, 10),
        approvalLog(TOKEN_B, WALLET, SPENDER_2, 42n, 11), // one genuine match, should NOT be counted
      ],
    });
    const { debug } = detectAnomalies(input);
    expect(debug.ignoredApprovalOwnerMismatch).toBe(1);
    expect(debug.ignoredTransferSenderMismatch).toBe(0);
  });

  it("counts a sender-mismatched outgoing-Transfer log via debug.ignoredTransferSenderMismatch", () => {
    const input = baseInput({
      outgoingTransferLogs: [
        outgoingTransferLog(TOKEN_A, OTHER_OWNER, 10), // wallet is not the sender
      ],
    });
    const { debug } = detectAnomalies(input);
    expect(debug.ignoredTransferSenderMismatch).toBe(1);
    expect(debug.ignoredApprovalOwnerMismatch).toBe(0);
  });

  it("returns zero-valued debug counters when every log matches the scanned wallet (no false alarm)", () => {
    const input = baseInput({
      approvalLogs: [approvalLog(TOKEN_A, WALLET, SPENDER_1, 1000n, 10)],
      outgoingTransferLogs: [outgoingTransferLog(TOKEN_A, WALLET, 20)],
    });
    const { debug } = detectAnomalies(input);
    expect(debug).toEqual({
      ignoredApprovalOwnerMismatch: 0,
      ignoredTransferSenderMismatch: 0,
    });
  });
});

describe("detectAnomalies() -- failed-tx detection", () => {
  it("emits one failed-tx anomaly per failed transaction", () => {
    const input = baseInput({
      failedTxs: [
        { transactionHash: "0xabc" as Hex, blockNumber: 5 },
        { transactionHash: "0xdef" as Hex, blockNumber: 6 },
      ],
    });
    const { anomalies } = detectAnomalies(input);
    const failed = anomalies.filter((a) => a.type === "failed-tx");
    expect(failed).toHaveLength(2);
    expect(failed[0]).toEqual({
      type: "failed-tx",
      transactionHash: "0xabc",
      blockNumber: 5,
    });
  });
});

describe("detectAnomalies() -- balance-drift detection (named threshold)", () => {
  it(`flags a token whose |usdValueChangeCents| meets the ${BALANCE_DRIFT_THRESHOLD_CENTS}-cent threshold`, () => {
    const input = baseInput({
      pnlReport: {
        wallet: WALLET,
        isBaseline: false,
        tokens: [
          {
            address: "native",
            symbol: "MON",
            amountChange: "1000000000000000000",
            usdValueChangeCents: BALANCE_DRIFT_THRESHOLD_CENTS,
          },
        ],
        usdValueChangeCents: BALANCE_DRIFT_THRESHOLD_CENTS,
      },
    });
    const { anomalies } = detectAnomalies(input);
    expect(anomalies).toEqual([
      {
        type: "balance-drift",
        address: "native",
        symbol: "MON",
        amountChange: "1000000000000000000",
        usdValueChangeCents: BALANCE_DRIFT_THRESHOLD_CENTS,
      },
    ]);
  });

  it("does NOT flag a token below the threshold", () => {
    const input = baseInput({
      pnlReport: {
        wallet: WALLET,
        isBaseline: false,
        tokens: [
          {
            address: "native",
            symbol: "MON",
            amountChange: "1",
            usdValueChangeCents: BALANCE_DRIFT_THRESHOLD_CENTS - 1,
          },
        ],
        usdValueChangeCents: BALANCE_DRIFT_THRESHOLD_CENTS - 1,
      },
    });
    const { anomalies } = detectAnomalies(input);
    expect(anomalies).toHaveLength(0);
  });

  it("flags a large negative drift the same as a large positive one (absolute value)", () => {
    const input = baseInput({
      pnlReport: {
        wallet: WALLET,
        isBaseline: false,
        tokens: [
          {
            address: "native",
            symbol: "MON",
            amountChange: "-1",
            usdValueChangeCents: -(BALANCE_DRIFT_THRESHOLD_CENTS + 50),
          },
        ],
        usdValueChangeCents: -(BALANCE_DRIFT_THRESHOLD_CENTS + 50),
      },
    });
    const { anomalies } = detectAnomalies(input);
    expect(anomalies.some((a) => a.type === "balance-drift")).toBe(true);
  });
});

describe("detectAnomalies() -- empty input", () => {
  it("returns zero anomalies and an empty approval state for a wallet with no activity", () => {
    const { anomalies, approvalState } = detectAnomalies(baseInput());
    expect(anomalies).toEqual([]);
    expect(approvalState).toEqual({});
  });
});
