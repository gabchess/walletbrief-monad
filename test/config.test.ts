import { afterEach, describe, expect, it, vi } from "vitest";

describe("scan configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("leaves SCAN_START_BLOCK undefined when it is not configured", async () => {
    vi.stubEnv("SCAN_START_BLOCK", "");
    const config = await import("../src/config.js");
    expect(config.SCAN_START_BLOCK).toBeUndefined();
  });

  it("defaults the bounded first-run lookback to 25,000 blocks", async () => {
    vi.stubEnv("SCAN_LOOKBACK_BLOCKS", "");
    const config = await import("../src/config.js");
    expect(
      (config as unknown as { SCAN_LOOKBACK_BLOCKS?: number })
        .SCAN_LOOKBACK_BLOCKS,
    ).toBe(25_000);
  });

  it("rejects a negative configured start block", async () => {
    vi.stubEnv("SCAN_START_BLOCK", "-1");
    await expect(import("../src/config.js")).rejects.toThrow(
      "SCAN_START_BLOCK must be a non-negative safe integer.",
    );
  });

  it("rejects a non-positive lookback", async () => {
    vi.stubEnv("SCAN_LOOKBACK_BLOCKS", "0");
    await expect(import("../src/config.js")).rejects.toThrow(
      "SCAN_LOOKBACK_BLOCKS must be a positive safe integer.",
    );
  });

  it("keeps hosted execution disabled unless explicitly enabled", async () => {
    vi.stubEnv("EXECUTE_ENABLED", "");
    const config = await import("../src/config.js");
    const getExecutionConfig = (
      config as unknown as { getExecutionConfig?: () => unknown }
    ).getExecutionConfig;
    expect(getExecutionConfig).toBeTypeOf("function");
    expect(() => getExecutionConfig!()).toThrow("Execution is disabled.");
  });

  it("rejects enabled execution without a 32-byte private key", async () => {
    vi.stubEnv("EXECUTE_ENABLED", "true");
    vi.stubEnv(
      "DEMO_EXECUTION_WALLET",
      "0x35160A4238CB5F3166046399c397B6E0c12FD872",
    );
    vi.stubEnv(
      "BATCH_EXECUTOR_ADDRESS",
      "0x3333333333333333333333333333333333333333",
    );
    vi.stubEnv("DEMO_WALLET_PRIVATE_KEY", "");
    const config = await import("../src/config.js");
    const getExecutionConfig = (
      config as unknown as { getExecutionConfig?: () => unknown }
    ).getExecutionConfig;
    expect(getExecutionConfig).toBeTypeOf("function");
    expect(() => getExecutionConfig!()).toThrow(
      "DEMO_WALLET_PRIVATE_KEY must be a 32-byte hex private key.",
    );
  });

  it("returns only the dedicated wallet, key, and mainnet RPC when enabled", async () => {
    vi.stubEnv("EXECUTE_ENABLED", "true");
    vi.stubEnv(
      "DEMO_EXECUTION_WALLET",
      "0x35160A4238CB5F3166046399c397B6E0c12FD872",
    );
    vi.stubEnv(
      "BATCH_EXECUTOR_ADDRESS",
      "0x3333333333333333333333333333333333333333",
    );
    vi.stubEnv("DEMO_WALLET_PRIVATE_KEY", `0x${"11".repeat(32)}`);
    vi.stubEnv("EXECUTE_RPC_URL", "https://rpc.monad.xyz");
    const config = await import("../src/config.js");
    const getExecutionConfig = (
      config as unknown as { getExecutionConfig?: () => unknown }
    ).getExecutionConfig;
    expect(getExecutionConfig).toBeTypeOf("function");
    expect(getExecutionConfig!()).toMatchObject({
      walletAddress: "0x35160A4238CB5F3166046399c397B6E0c12FD872",
      rpcUrl: "https://rpc.monad.xyz",
    });
  });
});
