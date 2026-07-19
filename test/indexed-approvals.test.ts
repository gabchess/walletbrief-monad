import { describe, expect, it, vi } from "vitest";
import { pad, type Address, type Hex } from "viem";
import { APPROVAL_EVENT_TOPIC } from "../src/anomalies.js";
import {
  buildApprovalQuery,
  discoverActiveApprovals,
  type ApprovalCandidate,
  type ApprovalQueryPage,
  type IndexedApprovalDeps,
} from "../src/indexed-approvals.js";

const OWNER = "0x35160A4238CB5F3166046399c397B6E0c12FD872" as const;
const TOKEN = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as const;
const SPENDER = "0x000000000000000000000000000000000000dEaD" as const;
const TX = `0x${"ab".repeat(32)}` as Hex;

function approvalLog(
  value: bigint,
  blockNumber: number,
  overrides: Partial<ApprovalQueryPage["logs"][number]> = {},
): ApprovalQueryPage["logs"][number] {
  return {
    address: TOKEN,
    topic0: APPROVAL_EVENT_TOPIC,
    topic1: pad(OWNER, { size: 32 }),
    topic2: pad(SPENDER, { size: 32 }),
    topic3: null,
    data: `0x${value.toString(16).padStart(64, "0")}` as Hex,
    block_number: blockNumber,
    transaction_hash: TX,
    log_index: 0,
    ...overrides,
  };
}

function deps(
  pages: Record<number, ApprovalQueryPage>,
  allowance: bigint = 10n,
): IndexedApprovalDeps {
  return {
    queryPage: vi.fn(async (_owner: Address, fromBlock: number) => {
      const page = pages[fromBlock];
      if (!page) throw new Error(`Unexpected page ${fromBlock}`);
      return page;
    }),
    readCurrentAllowances: vi.fn(async (_owner, candidates) =>
      candidates.map((candidate: ApprovalCandidate) => ({
        candidate,
        allowance,
        symbol: "WMON",
        decimals: 18,
      })),
    ),
  };
}

describe("buildApprovalQuery", () => {
  it("filters the Approval signature and requested owner globally", () => {
    expect(buildApprovalQuery(OWNER, 123)).toMatchObject({
      from_block: 123,
      logs: [
        {
          topics: [
            [APPROVAL_EVENT_TOPIC],
            [pad(OWNER, { size: 32 }).toLowerCase()],
          ],
        },
      ],
      field_selection: {
        log: [
          "address",
          "topic0",
          "topic1",
          "topic2",
          "topic3",
          "data",
          "block_number",
          "transaction_hash",
          "log_index",
        ],
      },
    });
  });
});

describe("discoverActiveApprovals", () => {
  it("paginates with next_block and never scans Monad RPC log windows", async () => {
    const mock = deps({
      0: { archiveHeight: 200, nextBlock: 100, logs: [] },
      100: {
        archiveHeight: 200,
        nextBlock: 200,
        logs: [approvalLog(10n, 150)],
      },
    });

    await discoverActiveApprovals(OWNER, mock);

    expect(mock.queryPage).toHaveBeenNthCalledWith(1, OWNER, 0);
    expect(mock.queryPage).toHaveBeenNthCalledWith(2, OWNER, 100);
  });

  it("keeps only the latest event for each token and spender", async () => {
    const mock = deps({
      0: {
        archiveHeight: 200,
        nextBlock: 200,
        logs: [approvalLog(5n, 100), approvalLog(10n, 150)],
      },
    });

    const approvals = await discoverActiveApprovals(OWNER, mock);
    const candidates = vi.mocked(mock.readCurrentAllowances).mock
      .calls[0]![1] as ApprovalCandidate[];

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.eventValue).toBe(10n);
    expect(approvals[0]).toMatchObject({
      owner: OWNER,
      token: TOKEN,
      spender: SPENDER,
      allowance: "10",
      symbol: "WMON",
      decimals: 18,
      blockNumber: 150,
    });
  });

  it("drops a grant whose latest event is a revoke without an RPC read", async () => {
    const mock = deps({
      0: {
        archiveHeight: 200,
        nextBlock: 200,
        logs: [approvalLog(10n, 100), approvalLog(0n, 150)],
      },
    });

    const approvals = await discoverActiveApprovals(OWNER, mock);

    expect(approvals).toEqual([]);
    expect(mock.readCurrentAllowances).not.toHaveBeenCalled();
  });

  it("uses current onchain allowance as the final active-state authority", async () => {
    const mock = deps(
      {
        0: {
          archiveHeight: 200,
          nextBlock: 200,
          logs: [approvalLog(10n, 150)],
        },
      },
      0n,
    );

    await expect(discoverActiveApprovals(OWNER, mock)).resolves.toEqual([]);
  });

  it("ignores ERC-721 Approval events that share the same topic0", async () => {
    const mock = deps({
      0: {
        archiveHeight: 200,
        nextBlock: 200,
        logs: [
          approvalLog(0n, 150, {
            topic3: `0x${"01".padStart(64, "0")}` as Hex,
            data: "0x",
          }),
        ],
      },
    });

    await expect(discoverActiveApprovals(OWNER, mock)).resolves.toEqual([]);
    expect(mock.readCurrentAllowances).not.toHaveBeenCalled();
  });
});
