import { NextResponse } from "next/server";
import { withTenant } from "@/modules/auth/middleware";
import { getAllLimitPolicies } from "@/modules/limits";
import { getActiveFeatureLocks, getAllFeatures } from "@/modules/enforcement";
import { getUsageCounters } from "@/modules/usage";

const FEATURE_METRICS: Record<string, string> = {
  "agents.create": "AGENTS",
  "knowledge_bases.create": "KNOWLEDGE_BASES",
  "calls.make": "CALLS",
  "calls.minutes": "CALL_MINUTES",
};

export const GET = withTenant(async (_request, session) => {
  const tenantId = session.tenantId;

  const [policies, locks, features, counters] = await Promise.all([
    getAllLimitPolicies(tenantId),
    getActiveFeatureLocks(tenantId),
    getAllFeatures(tenantId),
    getUsageCounters(tenantId),
  ]);

  const policyMap = new Map(policies.map((p) => [p.metric, p]));
  const lockSet = new Set(locks.map((l) => l.featureKey));
  const featureMap = new Map(features.map((f) => [f.featureKey, f]));
  const counterMap = new Map(counters.map((c) => [c.metric, c.value]));

  const entitlements: Record<string, {
    enabled: boolean;
    used: number;
    limit: number | null;
    status: "ok" | "warning" | "blocked";
    reason?: string;
  }> = {};

  for (const [featureKey, metricKey] of Object.entries(FEATURE_METRICS)) {
    const policy = policyMap.get(metricKey as never);
    const feature = featureMap.get(featureKey);
    const locked = lockSet.has(featureKey);
    const used = counterMap.get(metricKey as never) ?? 0;

    const featureEnabled = feature ? feature.enabled : true;
    const limit = policy?.limitValue ?? null;

    let status: "ok" | "warning" | "blocked" = "ok";
    let reason: string | undefined;

    if (!featureEnabled) {
      status = "blocked";
      reason = feature?.reason ?? "Feature disabled";
    } else if (locked) {
      status = "blocked";
      reason = "LIMIT_REACHED";
    } else if (limit !== null) {
      const warnAt = Math.floor(limit * (policy?.warnAtPct ?? 80) / 100);
      if (used >= limit) {
        status = "blocked";
        reason = "LIMIT_REACHED";
      } else if (used >= warnAt) {
        status = "warning";
      }
    }

    entitlements[featureKey] = {
      enabled: featureEnabled && !locked,
      used,
      limit,
      status,
      reason,
    };
  }

  return NextResponse.json(entitlements);
});
