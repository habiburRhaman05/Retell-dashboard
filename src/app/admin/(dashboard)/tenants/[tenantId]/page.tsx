import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TenantDetail } from "@/components/admin/tenant-detail";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) notFound();

  const [agents, knowledgeBases, recentAudit] = await Promise.all([
    prisma.locationAgent.findMany({
      where: { locationId: tenant.crmLocationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.locationKnowledgeBase.findMany({
      where: { locationId: tenant.crmLocationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const data = {
    id: tenant.id,
    name: tenant.name,
    email: tenant.email,
    crmLocationId: tenant.crmLocationId,
    status: tenant.status,
    createdAt: tenant.createdAt.toISOString(),
    agents: agents.map((a) => ({
      id: a.id,
      retellAgentId: a.retellAgentId,
      name: a.agentName ?? "Unnamed",
      createdAt: a.createdAt.toISOString(),
    })),
    knowledgeBases: knowledgeBases.map((kb) => ({
      id: kb.id,
      retellKbId: kb.retellKnowledgeBaseId,
      name: kb.knowledgeBaseName ?? "Unnamed",
      createdAt: kb.createdAt.toISOString(),
    })),
    auditLogs: recentAudit.map((log) => ({
      id: log.id,
      action: log.action,
      actorType: log.actorType,
      actorId: log.actorId,
      targetType: log.targetType,
      before: log.before,
      after: log.after,
      createdAt: log.createdAt.toISOString(),
    })),
  };

  return <TenantDetail tenant={data} />;
}
