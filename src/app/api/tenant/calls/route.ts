import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/modules/auth/middleware";
import { listCallsQuerySchema, listCallsForTenant } from "@/modules/call-history";

// GET /api/tenant/calls - this tenant's own call history, live from Retell,
// scoped server-side to the signed-in session's own agents. locationId is
// never read from the client, only session.crmLocationId.
export const GET = withTenant(async (request: NextRequest, session) => {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listCallsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const page = await listCallsForTenant(session.crmLocationId, parsed.data);
    return NextResponse.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load call history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
