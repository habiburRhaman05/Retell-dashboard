import { prisma } from "@/lib/prisma";

/** The Retell agent ids that belong to this tenant, used to scope every call lookup to them. */
export async function listAgentIdsForLocation(locationId: string): Promise<string[]> {
  const rows = await prisma.locationAgent.findMany({
    where: { locationId },
    select: { retellAgentId: true },
  });
  return rows.map((r) => r.retellAgentId);
}
