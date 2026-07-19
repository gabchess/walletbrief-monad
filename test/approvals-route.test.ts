import { afterEach, describe, expect, it } from "vitest";

const originalToken = process.env.HYPERSYNC_BEARER_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.HYPERSYNC_BEARER_TOKEN;
  else process.env.HYPERSYNC_BEARER_TOKEN = originalToken;
});

describe("GET /api/approvals", () => {
  it("rejects a malformed wallet before any indexed request", async () => {
    const { GET } = await import("../app/api/approvals/route.js");
    const response = await GET(
      new Request("http://localhost/api/approvals?address=not-a-wallet"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid 0x wallet address.",
    });
  });

  it("returns an explicit unavailable status when the server indexer is not configured", async () => {
    delete process.env.HYPERSYNC_BEARER_TOKEN;
    const { GET } = await import("../app/api/approvals/route.js");
    const response = await GET(
      new Request(
        "http://localhost/api/approvals?address=0x35160A4238CB5F3166046399c397B6E0c12FD872",
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Approval index is temporarily unavailable.",
    });
  });
});
