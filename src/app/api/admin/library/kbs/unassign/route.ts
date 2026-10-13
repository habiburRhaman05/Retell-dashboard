import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { unassignItemsSchema, unassignKbs } from "@/modules/assignments";

/** POST /api/admin/library/kbs/unassign — remove KBs from their tenant */
export const POST = withAdmin(async (request: NextRequest, session) => {
  const body = await request.json().catch(() => null);
  const parsed = unassignItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await unassignKbs(parsed.data.retellIds, session.adminId);
  return NextResponse.json(result);
});
