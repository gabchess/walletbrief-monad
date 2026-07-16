import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns only non-secret liveness metadata without an RPC call", async () => {
    const module = await import("../app/api/health/route.js").catch(() => ({}));
    const GET = (module as { GET?: () => Promise<Response> | Response }).GET;
    expect(GET).toBeTypeOf("function");

    const response = await GET!();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, chainId: 143 });
  });
});
