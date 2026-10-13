import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { assignItemsSchema, assignKbs } from "@/modules/assignments";
import * as retell from "@/lib/retell-api";

/** POST /api/admin/library/kbs/assign — assign KBs to a tenant */
export const POST = withAdmin(async (request: NextRequest, session) => {
  const body = await request.json().catch(() => null);
  const parsed = assignItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { locationId, retellIds } = parsed.data;
  const allKbs = await retell.listKnowledgeBases();

  try {
    const result = await assignKbs(locationId, retellIds, allKbs, session.adminId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "LIMIT_REACHED") {
      return NextResponse.json(
        { error: (err as Error).message, code: "LIMIT_REACHED" },
        { status: 403 }
      );
    }
    throw err;
  }
});
