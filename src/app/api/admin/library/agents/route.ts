import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import * as retell from "@/lib/retell-api";
import { getAgentLibrary } from "@/modules/assignments";

/** GET /api/admin/library/agents — all agents with assignment status */
export const GET = withAdmin(async () => {
  const allAgents = await retell.listAllAgents();
  const library = await getAgentLibrary(allAgents);
  return NextResponse.json(library);
});
