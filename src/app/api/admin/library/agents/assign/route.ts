import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { assignItemsSchema, assignAgents } from "@/modules/assignments";
import * as retell from "@/lib/retell-api";

/** POST /api/admin/library/agents/assign — assign agents to a tenant */
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
  const allAgents = await retell.listAllAgents();

  try {
    const result = await assignAgents(locationId, retellIds, allAgents, session.adminId);
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
