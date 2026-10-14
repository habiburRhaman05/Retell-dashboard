import { NextResponse } from "next/server";
import { withTenant } from "@/modules/auth/middleware";
import { getCallForTenant, CallNotFoundError } from "@/modules/call-history";

// GET /api/tenant/calls/[callId] - one call's full detail (transcript,
// recording, AI analysis, detail logs). Ownership is verified server-side:
// the call's agent_id must belong to the signed-in tenant, or this 403s
// without revealing whether the call exists at all.
export const GET = withTenant(async (_request, session, { params }) => {
  const { callId } = params;

  try {
    const detail = await getCallForTenant(session.crmLocationId, callId);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof CallNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to load call";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
