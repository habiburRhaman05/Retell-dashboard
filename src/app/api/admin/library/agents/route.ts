import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import * as retell from "@/lib/retell-api";
import { getAgentLibrary } from "@/modules/assignments";

/** GET /api/admin/library/agents — all agents with assignment status */
export const GET = withAdmin(async () => {
  const allAgents = await retell.listAllAgents();
  const library = await getAgentLibrary(allAgents);
  let numberMap: Map<string, string[]> | null = null;
  try {
    numberMap = retell.connectedPhoneNumbersByAgent(await retell.listPhoneNumbers());
  } catch {
    // Agent library remains usable while phone-number metadata is unavailable.
  }
  return NextResponse.json(library.map((agent) => ({
    ...agent,
    connectedPhoneNumbers: numberMap ? numberMap.get(agent.agentId) ?? [] : null,
  })));
});
