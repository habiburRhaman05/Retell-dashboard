import { prisma } from "@/lib/prisma";
import { AuditLogView } from "@/components/admin/audit-log-view";

export default async function AuditLogPage() {
  const [logs, tenants] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const data = logs.map((log) => ({
    id: log.id,
    action: log.action,
    actorType: log.actorType,
    actorId: log.actorId,
    targetType: log.targetType,
    targetId: log.targetId,
    tenantId: log.tenantId,
    before: log.before,
    after: log.after,
    createdAt: log.createdAt.toISOString(),
  }));

  return <AuditLogView logs={data} tenants={tenants} />;
}
