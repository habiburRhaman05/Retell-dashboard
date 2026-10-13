import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { privateItemsSchema, makeAgentsPrivate } from "@/modules/assignments";

/** POST /api/admin/library/agents/private — hide agents from all tenants */
export const POST = withAdmin(async (request: NextRequest, session) => {
  const body = await request.json().catch(() => null);
  const parsed = privateItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await makeAgentsPrivate(parsed.data.retellIds, session.adminId, parsed.data.reason);
  return NextResponse.json(result);
});
