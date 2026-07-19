import { discoverActiveApprovals } from "../../../src/indexed-approvals.js";
import { parseSearchAddress } from "../../../src/search.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const value = new URL(request.url).searchParams.get("address") ?? "";
  let owner;
  try {
    owner = parseSearchAddress(value);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid wallet." },
      { status: 400 },
    );
  }

  if (!process.env.HYPERSYNC_BEARER_TOKEN) {
    return Response.json(
      { error: "Approval index is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const approvals = await discoverActiveApprovals(owner);
    return Response.json({ approvals });
  } catch (error) {
    console.error("Approval discovery failed", error);
    return Response.json(
      { error: "Approval index is temporarily unavailable." },
      { status: 503 },
    );
  }
}
