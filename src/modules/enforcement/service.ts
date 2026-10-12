import { prisma } from "@/lib/prisma";
import type { MetricType } from "@prisma/client";

export type AccessResult =
  | { allowed: true; warnings?: string[] }
  | { allowed: false; code: "ACCOUNT_SUSPENDED" | "FEATURE_DISABLED" | "LIMIT_REACHED"; reason: string; used?: number; limit?: number; metric?: MetricType };

export async function checkAccess(
  tenantId: string,
  featureKey: string,
  metric?: MetricType
): Promise<AccessResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true },
  });

  if (!tenant || tenant.status === "suspended") {
    return { allowed: false, code: "ACCOUNT_SUSPENDED", reason: "This account is suspended. Contact support." };
  }

  const feature = await prisma.tenantFeature.findUnique({
    where: { tenantId_featureKey: { tenantId, featureKey } },
  });

  if (feature && !feature.enabled) {
    return { allowed: false, code: "FEATURE_DISABLED", reason: feature.reason ?? "This feature has been disabled." };
  }

  if (metric) {
    const lock = await prisma.featureLock.findFirst({
      where: { tenantId, featureKey, clearedAt: null },
    });

    if (lock) {
      const policy = await prisma.limitPolicy.findUnique({
        where: { tenantId_metric: { tenantId, metric } },
      });
      return {
        allowed: false,
        code: "LIMIT_REACHED",
        reason: lock.reason ?? "Limit reached for this feature.",
        metric,
        used: policy?.limitValue,
        limit: policy?.limitValue,
      };
    }
  }

  return { allowed: true };
}

export async function createFeatureLock(
  tenantId: string,
  featureKey: string,
  metric: MetricType,
  reason: string
) {
  const existing = await prisma.featureLock.findFirst({
    where: { tenantId, featureKey, metric, clearedAt: null },
  });
  if (existing) return existing;

  return prisma.featureLock.create({
    data: { tenantId, featureKey, metric, reason },
  });
}

export async function clearFeatureLock(
  tenantId: string,
  featureKey: string,
  metric?: MetricType
) {
  const where: Record<string, unknown> = { tenantId, featureKey, clearedAt: null };
  if (metric) where.metric = metric;

  return prisma.featureLock.updateMany({
    where,
    data: { clearedAt: new Date() },
  });
}

export async function getActiveFeatureLocks(tenantId: string) {
  return prisma.featureLock.findMany({
    where: { tenantId, clearedAt: null },
  });
}

export async function setFeatureEnabled(
  tenantId: string,
  featureKey: string,
  enabled: boolean,
  reason: string | null,
  changedBy: string
) {
  return prisma.tenantFeature.upsert({
    where: { tenantId_featureKey: { tenantId, featureKey } },
    create: { tenantId, featureKey, enabled, reason, changedBy },
    update: { enabled, reason, changedBy, changedAt: new Date() },
  });
}

export async function getFeatureStatus(tenantId: string, featureKey: string) {
  const feature = await prisma.tenantFeature.findUnique({
    where: { tenantId_featureKey: { tenantId, featureKey } },
  });
  return feature ?? { featureKey, enabled: true, reason: null };
}

export async function getAllFeatures(tenantId: string) {
  return prisma.tenantFeature.findMany({
    where: { tenantId },
  });
}
