import { prisma } from "@/lib/prisma";
import { TenantsTable } from "@/components/admin/tenants-table";

export default async function AdminOverviewPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          limitPolicies: true,
          featureLocks: true,
        },
      },
    },
  });

  const locationIds = tenants.map((t) => t.crmLocationId);

  const [agentCounts, kbCounts] = await Promise.all([
    prisma.locationAgent.groupBy({
      by: ["locationId"],
      where: { locationId: { in: locationIds } },
      _count: true,
    }),
    prisma.locationKnowledgeBase.groupBy({
      by: ["locationId"],
      where: { locationId: { in: locationIds } },
      _count: true,
    }),
  ]);

  const agentMap = new Map(agentCounts.map((r) => [r.locationId, r._count]));
  const kbMap = new Map(kbCounts.map((r) => [r.locationId, r._count]));

  const data = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    crmLocationId: t.crmLocationId,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    agentCount: agentMap.get(t.crmLocationId) ?? 0,
    kbCount: kbMap.get(t.crmLocationId) ?? 0,
    hasLocks: t._count.featureLocks > 0,
  }));

  return <TenantsTable tenants={data} />;
}
