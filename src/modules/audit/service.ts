import { prisma } from "@/lib/prisma";

export interface AuditEntry {
  actorType: "admin" | "system";
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  tenantId?: string;
  before?: unknown;
  after?: unknown;
}

export async function writeAuditLog(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      tenantId: entry.tenantId,
      before: entry.before as object | undefined,
      after: entry.after as object | undefined,
    },
  });
}

export async function listAuditLogs(filters?: {
  tenantId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.tenantId) where.tenantId = filters.tenantId;
  if (filters?.action) where.action = filters.action;

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
  });
}
