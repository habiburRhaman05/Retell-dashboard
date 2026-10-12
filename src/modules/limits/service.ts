import { prisma } from "@/lib/prisma";
import type { MetricType, LimitMode } from "@prisma/client";
import { monthlyPeriodStart } from "@/modules/usage";

export type LimitResult =
  | { status: "allow" }
  | { status: "warn"; used: number; limit: number; metric: MetricType }
  | { status: "block"; used: number; limit: number; metric: MetricType; message: string };

// Enforce a limit for a CRM location: resolves the owning tenant first.
// Locations without a tenant (or metrics without a policy) are always allowed.
export async function checkLimitForLocation(
  locationId: string,
  metric: MetricType,
  amount: number = 1
): Promise<LimitResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { crmLocationId: locationId },
    select: { id: true },
  });
  if (!tenant) return { status: "allow" };
  return checkLimit(tenant.id, metric, amount);
}

export async function checkLimit(
  tenantId: string,
  metric: MetricType,
  amount: number = 1
): Promise<LimitResult> {
  const policy = await prisma.limitPolicy.findUnique({
    where: { tenantId_metric: { tenantId, metric } },
  });

  if (!policy) return { status: "allow" };

  const used = await getCurrentUsage(tenantId, metric, policy.period);
  const wouldUse = used + amount;

  if (wouldUse > policy.limitValue) {
    if (policy.mode === "soft") {
      return { status: "warn", used, limit: policy.limitValue, metric };
    }
    return {
      status: "block",
      used,
      limit: policy.limitValue,
      metric,
      message: `Limit reached: ${used}/${policy.limitValue} ${formatMetric(metric)}`,
    };
  }

  const warnThreshold = Math.floor(policy.limitValue * policy.warnAtPct / 100);
  if (wouldUse >= warnThreshold) {
    return { status: "warn", used, limit: policy.limitValue, metric };
  }

  return { status: "allow" };
}

export async function checkLimitAtomic(
  tenantId: string,
  metric: MetricType
): Promise<LimitResult> {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.limitPolicy.findUnique({
      where: { tenantId_metric: { tenantId, metric } },
    });

    if (!policy) return { status: "allow" as const };

    const used = await getCurrentUsageTx(tx, tenantId, metric, policy.period);

    if (used >= policy.limitValue) {
      if (policy.mode === "soft") {
        return { status: "warn" as const, used, limit: policy.limitValue, metric };
      }
      return {
        status: "block" as const,
        used,
        limit: policy.limitValue,
        metric,
        message: `Limit reached: ${used}/${policy.limitValue} ${formatMetric(metric)}`,
      };
    }

    return { status: "allow" as const };
  });
}

// Live usage for a metric: AGENTS / KNOWLEDGE_BASES are counted from their
// mapping tables (usageCounter only ever holds CALLS / CALL_MINUTES).
export async function getCurrentUsage(
  tenantId: string,
  metric: MetricType,
  period: string = "monthly"
): Promise<number> {
  if (metric === "AGENTS") {
    return prisma.locationAgent.count({
      where: { location: { locationId: await getCrmLocationId(tenantId) } },
    });
  }

  if (metric === "KNOWLEDGE_BASES") {
    return prisma.locationKnowledgeBase.count({
      where: { location: { locationId: await getCrmLocationId(tenantId) } },
    });
  }

  if (period === "monthly") {
    const ps = monthlyPeriodStart();
    const counter = await prisma.usageCounter.findUnique({
      where: { tenantId_metric_periodStart: { tenantId, metric, periodStart: ps } },
    });
    return counter?.value ?? 0;
  }

  const counters = await prisma.usageCounter.findMany({
    where: { tenantId, metric },
  });
  return counters.reduce((sum, c) => sum + c.value, 0);
}

async function getCurrentUsageTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string,
  metric: MetricType,
  period: string
): Promise<number> {
  if (metric === "AGENTS") {
    const crmId = await getCrmLocationIdTx(tx, tenantId);
    return tx.locationAgent.count({
      where: { location: { locationId: crmId } },
    });
  }

  if (metric === "KNOWLEDGE_BASES") {
    const crmId = await getCrmLocationIdTx(tx, tenantId);
    return tx.locationKnowledgeBase.count({
      where: { location: { locationId: crmId } },
    });
  }

  if (period === "monthly") {
    const ps = monthlyPeriodStart();
    const counter = await tx.usageCounter.findUnique({
      where: { tenantId_metric_periodStart: { tenantId, metric, periodStart: ps } },
    });
    return counter?.value ?? 0;
  }

  const counters = await tx.usageCounter.findMany({
    where: { tenantId, metric },
  });
  return counters.reduce((sum, c) => sum + c.value, 0);
}

async function getCrmLocationId(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { crmLocationId: true },
  });
  return tenant?.crmLocationId ?? "";
}

async function getCrmLocationIdTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string
): Promise<string> {
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { crmLocationId: true },
  });
  return tenant?.crmLocationId ?? "";
}

function formatMetric(metric: MetricType): string {
  const names: Record<MetricType, string> = {
    AGENTS: "agents",
    KNOWLEDGE_BASES: "knowledge bases",
    CALL_MINUTES: "call minutes",
    CALLS: "calls",
    CONCURRENT_CALLS: "concurrent calls",
  };
  return names[metric] ?? metric;
}

export async function getLimitPolicy(tenantId: string, metric: MetricType) {
  return prisma.limitPolicy.findUnique({
    where: { tenantId_metric: { tenantId, metric } },
  });
}

export async function getAllLimitPolicies(tenantId: string) {
  return prisma.limitPolicy.findMany({
    where: { tenantId },
  });
}

export async function setLimitPolicy(
  tenantId: string,
  metric: MetricType,
  data: { limitValue: number; period?: "monthly" | "lifetime"; warnAtPct?: number; mode?: LimitMode }
) {
  return prisma.limitPolicy.upsert({
    where: { tenantId_metric: { tenantId, metric } },
    create: {
      tenantId,
      metric,
      limitValue: data.limitValue,
      period: data.period ?? "monthly",
      warnAtPct: data.warnAtPct ?? 80,
      mode: data.mode ?? "hard",
    },
    update: {
      limitValue: data.limitValue,
      ...(data.period && { period: data.period }),
      ...(data.warnAtPct != null && { warnAtPct: data.warnAtPct }),
      ...(data.mode && { mode: data.mode }),
    },
  });
}

export async function deleteLimitPolicy(tenantId: string, metric: MetricType) {
  return prisma.limitPolicy.delete({
    where: { tenantId_metric: { tenantId, metric } },
  });
}
