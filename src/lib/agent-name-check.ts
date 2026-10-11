import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { sameAgentName } from "@/lib/agent-names";

/**
 * Is another agent in this location already called `name`? Names come from
 * Retell (newest version of each agent), not from our saved copy, so a rename
 * made elsewhere is taken into account.
 */
export async function nameTakenInLocation(
  locationId: string,
  name: string,
  excludeAgentId?: string
): Promise<boolean> {
  const mappings = await prisma.locationAgent.findMany({
    where: { locationId },
    select: { retellAgentId: true },
  });
  if (mappings.length === 0) return false;
  const ids = new Set(mappings.map((m) => m.retellAgentId));
  const agents = await retell.listAllAgents();
  return agents.some(
    (a) => ids.has(a.agent_id) && a.agent_id !== excludeAgentId && sameAgentName(a.agent_name, name)
  );
}
