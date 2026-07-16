import { describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import type { WalletBrief, WalletSection } from "../src/orchestrate.js";
import type { ExecuteClients, ProposedAction } from "../src/execute.js";
import { approveConfiguredWallet } from "../src/approve.js";

const WALLET = "0x35160A4238CB5F3166046399c397B6E0c12FD872" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;
const IMPLEMENTATION = "0x3333333333333333333333333333333333333333" as Address;
const TOKEN = "0x4444444444444444444444444444444444444444" as Address;
const TX_HASH = `0x${"ab".repeat(32)}` as Hex;

const PROPOSED: ProposedAction = {
  implementationAddress: IMPLEMENTATION,
  approvalDigest: `0x${"11".repeat(32)}` as Hex,
  actions: [{ target: TOKEN, data: "0x095ea7b3" }],
  hasActions: true,
};

function brief(actionable = true): WalletBrief {
  const section = {
    kind: "ok",
    wallet: WALLET,
    proposedAction: PROPOSED,
  } as WalletSection;
  return {
    wallets: actionable ? [section] : [],
    aggregate: { wallets: [], totalUsdValueChangeCents: 0 },
    checkedAt: "2026-07-15T00:00:00.000Z",
    actionableWallet: actionable ? section : undefined,
  };
}

function clients(): ExecuteClients {
  return {
    signAuthorization: vi.fn().mockResolvedValue({ signed: true }),
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
    waitForTransactionReceipt: vi
      .fn()
      .mockResolvedValue({ status: "success", blockNumber: 100n }),
  };
}

describe("approveConfiguredWallet", () => {
  it("rejects an invalid wallet before recomputing or signing", async () => {
    const runBrief = vi.fn();
    const makeClients = vi.fn();
    const result = await approveConfiguredWallet("not-an-address", {
      configuredWallet: WALLET,
      runBrief,
      makeClients,
    });

    expect(result).toMatchObject({ kind: "rejected" });
    expect(runBrief).not.toHaveBeenCalled();
    expect(makeClients).not.toHaveBeenCalled();
  });

  it("rejects an unconfigured wallet before recomputing or signing", async () => {
    const runBrief = vi.fn();
    const makeClients = vi.fn();

    const result = await approveConfiguredWallet(OTHER, {
      configuredWallet: WALLET,
      runBrief,
      makeClients,
    });

    expect(result).toMatchObject({ kind: "rejected" });
    expect(runBrief).not.toHaveBeenCalled();
    expect(makeClients).not.toHaveBeenCalled();
  });

  it("executes only the proposal recomputed by the server", async () => {
    const executeClients = clients();

    const result = await approveConfiguredWallet(WALLET, {
      configuredWallet: WALLET,
      runBrief: vi.fn().mockResolvedValue(brief(true)),
      makeClients: vi.fn().mockReturnValue({
        signerAddress: WALLET,
        clients: executeClients,
      }),
    });

    expect(result).toMatchObject({ kind: "executed", txHash: TX_HASH });
    expect(executeClients.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: WALLET,
        args: [PROPOSED.approvalDigest, PROPOSED.actions],
      }),
    );
  });

  it("returns no-op without creating signer clients when live state has no revoke", async () => {
    const makeClients = vi.fn();

    const result = await approveConfiguredWallet(WALLET, {
      configuredWallet: WALLET,
      runBrief: vi.fn().mockResolvedValue(brief(false)),
      makeClients,
    });

    expect(result).toMatchObject({ kind: "noop" });
    expect(makeClients).not.toHaveBeenCalled();
  });

  it("rejects a signer that does not control the configured wallet", async () => {
    const executeClients = clients();

    const result = await approveConfiguredWallet(WALLET, {
      configuredWallet: WALLET,
      runBrief: vi.fn().mockResolvedValue(brief(true)),
      makeClients: vi.fn().mockReturnValue({
        signerAddress: OTHER,
        clients: executeClients,
      }),
    });

    expect(result).toMatchObject({ kind: "rejected" });
    expect(executeClients.signAuthorization).not.toHaveBeenCalled();
  });

  it("submits once and makes a second recomputation an honest no-op", async () => {
    const executeClients = clients();
    const runBrief = vi
      .fn()
      .mockResolvedValueOnce(brief(true))
      .mockResolvedValueOnce(brief(false));
    const makeClients = vi.fn().mockReturnValue({
      signerAddress: WALLET,
      clients: executeClients,
    });
    const deps = { configuredWallet: WALLET, runBrief, makeClients };

    await expect(approveConfiguredWallet(WALLET, deps)).resolves.toMatchObject({
      kind: "executed",
    });
    await expect(approveConfiguredWallet(WALLET, deps)).resolves.toMatchObject({
      kind: "noop",
    });
    expect(executeClients.writeContract).toHaveBeenCalledTimes(1);
  });
});
