import { describe, expect, it, vi } from "vitest";
import { execute, type ExecuteClients } from "../src/execute.js";
import type { ProposedAction } from "../src/execute.js";

const WALLET_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
const IMPLEMENTATION_ADDRESS =
  "0x2222222222222222222222222222222222222222" as const;
const TOKEN_ADDRESS = "0x3333333333333333333333333333333333333333" as const;
const TX_HASH =
  "0xdeadbeef00000000000000000000000000000000000000000000000000000000dead" as const;

const proposed: ProposedAction = {
  implementationAddress: IMPLEMENTATION_ADDRESS,
  approvalDigest:
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  actions: [{ target: TOKEN_ADDRESS, data: "0x095ea7b3" }],
  hasActions: true,
};

const emptyProposed: ProposedAction = {
  implementationAddress: IMPLEMENTATION_ADDRESS,
  approvalDigest:
    "0x0000000000000000000000000000000000000000000000000000000000000002",
  actions: [],
  hasActions: false,
};

function mockClients(overrides: Partial<ExecuteClients> = {}): ExecuteClients {
  return {
    signAuthorization: vi
      .fn()
      .mockResolvedValue({ contractAddress: IMPLEMENTATION_ADDRESS }),
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
    waitForTransactionReceipt: vi
      .fn()
      .mockResolvedValue({ status: "success", blockNumber: 42n }),
    ...overrides,
  };
}

describe("execute(ProposedAction, walletAddress, clients) -> TxReceipt", () => {
  it("signs an EIP-7702 authorization delegating to the implementation contract", async () => {
    const clients = mockClients();
    await execute(proposed, WALLET_ADDRESS, clients);
    expect(clients.signAuthorization).toHaveBeenCalledWith({
      contractAddress: IMPLEMENTATION_ADDRESS,
      executor: "self",
    });
  });

  it("submits executeBatch to the wallet's own address with the signed authorization attached", async () => {
    const clients = mockClients();
    await execute(proposed, WALLET_ADDRESS, clients);
    expect(clients.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: WALLET_ADDRESS,
        functionName: "executeBatch",
        args: [proposed.approvalDigest, proposed.actions],
        authorizationList: [{ contractAddress: IMPLEMENTATION_ADDRESS }],
      }),
    );
  });

  it("returns kind:executed, success:true and the tx hash for a successful receipt", async () => {
    const clients = mockClients();
    const receipt = await execute(proposed, WALLET_ADDRESS, clients);
    expect(receipt).toEqual({
      kind: "executed",
      txHash: TX_HASH,
      success: true,
      blockNumber: 42,
    });
  });

  it("returns success:false (does not throw) for a reverted receipt", async () => {
    const clients = mockClients({
      waitForTransactionReceipt: vi
        .fn()
        .mockResolvedValue({ status: "reverted", blockNumber: 43n }),
    });
    const receipt = await execute(proposed, WALLET_ADDRESS, clients);
    expect(receipt.kind).toBe("executed");
    if (receipt.kind === "executed") {
      expect(receipt.success).toBe(false);
    }
  });

  it("propagates a thrown error from writeContract (e.g. simulation-time revert) unchanged", async () => {
    const clients = mockClients({
      writeContract: vi.fn().mockRejectedValue(new Error("DigestAlreadyUsed")),
    });
    await expect(execute(proposed, WALLET_ADDRESS, clients)).rejects.toThrow(
      "DigestAlreadyUsed",
    );
  });

  describe("review hardening: empty-batch guard", () => {
    it("returns a noop result without calling any client method when hasActions is false", async () => {
      const clients = mockClients();
      const result = await execute(emptyProposed, WALLET_ADDRESS, clients);
      expect(result.kind).toBe("noop");
      expect(clients.signAuthorization).not.toHaveBeenCalled();
      expect(clients.writeContract).not.toHaveBeenCalled();
      expect(clients.waitForTransactionReceipt).not.toHaveBeenCalled();
    });

    it("defends against a hasActions:true / actions:[] mismatch by checking actions.length too", async () => {
      const clients = mockClients();
      const inconsistent: ProposedAction = {
        ...emptyProposed,
        hasActions: true,
      };
      const result = await execute(inconsistent, WALLET_ADDRESS, clients);
      expect(result.kind).toBe("noop");
      expect(clients.writeContract).not.toHaveBeenCalled();
    });
  });
});
