import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { unprivateItemsSchema, makeAgentsPublic } from "@/modules/assignments";

/** POST /api/admin/library/agents/unprivate — make agents visible again */
export const POST = withAdmin(async (request: NextRequest, session) => {
  const body = await request.json().catch(() => null);
  const parsed = unprivateItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await makeAgentsPublic(parsed.data.retellIds, session.adminId);
  return NextResponse.json(result);
});
