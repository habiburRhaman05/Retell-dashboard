import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { getCurrentUsage } from "@/modules/limits";
import { clearFeatureLock, createFeatureLock } from "@/modules/enforcement";
import type { RetellPhoneNumberSummary } from "@/lib/retell-api";

type VoiceRoutes = {
  inbound_agents: NonNullable<RetellPhoneNumberSummary["inbound_agents"]>;
  outbound_agents: NonNullable<RetellPhoneNumberSummary["outbound_agents"]>;
};
const EMPTY_ROUTES: VoiceRoutes = { inbound_agents: [], outbound_agents: [] };

function routesFor(phone: RetellPhoneNumberSummary): VoiceRoutes {
  return {
    inbound_agents: (phone.inbound_agents ?? []).map((entry) => ({ ...entry })),
    outbound_agents: (phone.outbound_agents ?? []).map((entry) => ({ ...entry })),
  };
}

function sameRoutes(left: VoiceRoutes, right: VoiceRoutes): boolean {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, stable(entry)])
      );
    }
    return value;
  };
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function asRoutes(value: unknown): VoiceRoutes {
  if (!value || typeof value !== "object") return EMPTY_ROUTES;
  const record = value as Partial<VoiceRoutes>;
  return {
    inbound_agents: Array.isArray(record.inbound_agents) ? record.inbound_agents : [],
    outbound_agents: Array.isArray(record.outbound_agents) ? record.outbound_agents : [],
  };
}

function filterAndNormalize(
  assignments: VoiceRoutes["inbound_agents"],
  blockedAgentIds: Set<string>
): VoiceRoutes["inbound_agents"] {
  const retained = assignments.filter((item) => !blockedAgentIds.has(item.agent_id));
  if (retained.length === assignments.length || retained.length === 0) return retained;
  const weights = retained.map((item) => item.weight);
  if (weights.some((weight) => typeof weight !== "number" || !Number.isFinite(weight) || weight < 0)) {
    return retained;
  }
  const total = (weights as number[]).reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return retained;

  let normalizedTotal = 0;
  return retained.map((item, index) => {
    const weight = index === retained.length - 1
      ? 1 - normalizedTotal
      : item.weight! / total;
    normalizedTotal += weight;
    return { ...item, weight };
  });
}

async function getBlockedAgentIds(): Promise<Set<string>> {
  const tenants = await prisma.tenant.findMany({
    where: {
      limitPolicies: {
        some: { metric: { in: ["CALL_MINUTES", "CALLS"] }, mode: "hard" },
      },
    },
    select: {
      id: true,
      crmLocationId: true,
      limitPolicies: {
        where: { metric: { in: ["CALL_MINUTES", "CALLS"] }, mode: "hard" },
      },
    },
  });
  const blockedLocations = new Set<string>();
  for (const tenant of tenants) {
    for (const policy of tenant.limitPolicies) {
      const used = await getCurrentUsage(tenant.id, policy.metric, policy.period);
      if (used >= policy.limitValue) {
        blockedLocations.add(tenant.crmLocationId);
        break;
      }
    }
  }
  if (!blockedLocations.size) return new Set();
  const mappings = await prisma.locationAgent.findMany({
    where: { locationId: { in: [...blockedLocations] } },
    select: { retellAgentId: true },
  });
  return new Set(mappings.map((item) => item.retellAgentId));
}

/**
 * Reconcile shared phone routes against every currently blocked tenant.
 * One baseline per Retell number prevents restoring one tenant's agents while
 * another tenant sharing that number is still over its hard call limit.
 */
async function reconcilePhoneRouting() {
  const [blockedAgentIds, snapshots] = await Promise.all([
    getBlockedAgentIds(), prisma.phoneRoutingSnapshot.findMany(),
  ]);
  const hasActiveSnapshots = snapshots.some((item) => ["pending", "suspended", "error", "needs_review"].includes(item.status));
  if (!blockedAgentIds.size && !hasActiveSnapshots) return { changed: 0, errors: [] as string[] };
  const phoneNumbers = await retell.listPhoneNumbers();
  const snapshotByNumber = new Map(snapshots.map((snapshot) => [snapshot.phoneNumber, snapshot]));
  const seen = new Set<string>();
  const errors: string[] = [];
  let changed = 0;

  for (const phone of phoneNumbers) {
    seen.add(phone.phone_number);
    const current = routesFor(phone);
    const snapshot = snapshotByNumber.get(phone.phone_number);
    const activeSnapshot = snapshot && ["pending", "suspended", "error"].includes(snapshot.status);
    if (snapshot?.status === "needs_review") {
      errors.push(`${phone.phone_number}: routing needs admin review`);
      continue;
    }

    const baseline = activeSnapshot ? asRoutes(snapshot.beforeRoutes) : current;
    const target: VoiceRoutes = {
      // A configured inbound webhook can dynamically select an agent and
      // override these bindings. Leave those inbound routes intact and surface
      // the bypass for review; outbound routes can still be suspended safely.
      inbound_agents: phone.inbound_webhook_url
        ? baseline.inbound_agents
        : filterAndNormalize(baseline.inbound_agents, blockedAgentIds),
      outbound_agents: filterAndNormalize(baseline.outbound_agents, blockedAgentIds),
    };
    if (phone.inbound_webhook_url && baseline.inbound_agents.some((item) => blockedAgentIds.has(item.agent_id))) {
      errors.push(`${phone.phone_number}: inbound webhook may dynamically route blocked agents; inbound route left unchanged`);
    }

    if (activeSnapshot) {
      const previouslyApplied = asRoutes(snapshot.expectedRoutes);
      // A pending PATCH may have reached Retell before the process stopped.
      // Only retry if Retell still matches either known safe state.
      if (!sameRoutes(current, previouslyApplied) && !sameRoutes(current, baseline)) {
        const message = "Routing changed outside call-limit enforcement; left current routes untouched";
        await prisma.phoneRoutingSnapshot.update({
          where: { id: snapshot.id },
          data: { status: "needs_review", error: message },
        });
        errors.push(`${phone.phone_number}: ${message}`);
        continue;
      }
    }

    if (sameRoutes(current, target)) {
      if (activeSnapshot && sameRoutes(target, baseline)) {
        await prisma.phoneRoutingSnapshot.update({
          where: { id: snapshot.id }, data: { status: "restored", error: null },
        });
      } else if (activeSnapshot && !sameRoutes(target, asRoutes(snapshot.expectedRoutes))) {
        await prisma.phoneRoutingSnapshot.update({
          where: { id: snapshot.id },
          data: { expectedRoutes: target as object, status: "suspended", error: null },
        });
      } else if (activeSnapshot && snapshot.status !== "suspended") {
        await prisma.phoneRoutingSnapshot.update({
          where: { id: snapshot.id }, data: { status: "suspended", error: null },
        });
      }
      continue;
    }

    // Create or refresh the durable write-ahead snapshot before contacting Retell.
    const saved = await prisma.phoneRoutingSnapshot.upsert({
      where: { phoneNumber: phone.phone_number },
      create: {
        phoneNumber: phone.phone_number,
        beforeRoutes: baseline as object,
        expectedRoutes: target as object,
        status: "pending",
      },
      update: {
        beforeRoutes: baseline as object,
        expectedRoutes: target as object,
        status: "pending",
        error: null,
      },
    });
    try {
      await retell.updatePhoneNumberRoutes(phone.phone_number, target);
      await prisma.phoneRoutingSnapshot.update({
        where: { id: saved.id },
        data: {
          status: sameRoutes(target, baseline) ? "restored" : "suspended",
          error: null,
        },
      });
      changed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retell routing update failed";
      await prisma.phoneRoutingSnapshot.update({
        where: { id: saved.id }, data: { status: "error", error: message.slice(0, 1000) },
      });
      errors.push(`${phone.phone_number}: ${message}`);
    }
  }

  for (const snapshot of snapshots) {
    if (seen.has(snapshot.phoneNumber) || !["pending", "suspended", "error"].includes(snapshot.status)) continue;
    const message = "Phone number is not present in Retell; no resource was deleted by this app";
    await prisma.phoneRoutingSnapshot.update({
      where: { id: snapshot.id }, data: { status: "needs_review", error: message },
    });
    errors.push(`${snapshot.phoneNumber}: ${message}`);
  }
  return { changed, errors };
}

async function reconcileTenantLock(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!tenant) throw new Error("Tenant not found");
  const policies = await prisma.limitPolicy.findMany({
    where: { tenantId, metric: { in: ["CALL_MINUTES", "CALLS"] }, mode: "hard" },
  });
  for (const policy of policies) {
    const used = await getCurrentUsage(tenantId, policy.metric, policy.period);
    if (used >= policy.limitValue) {
      await createFeatureLock(
        tenantId,
        "calls.make",
        policy.metric,
        "LIMIT_REACHED"
      );
      return { blocked: true, metric: policy.metric, used, limit: policy.limitValue };
    }
  }
  await clearFeatureLock(tenantId, "calls.make");
  return { blocked: false as const };
}

/** Reconcile current policy and usage with dashboard access and Retell routing. */
export async function reconcileCallLimitForTenant(tenantId: string) {
  const access = await reconcileTenantLock(tenantId);
  const routing = await reconcilePhoneRouting();
  return { ...access, routing };
}

export async function reconcileAllCallLimits() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const tenantResults: { tenantId: string; error?: string }[] = [];
  for (const tenant of tenants) {
    try {
      await reconcileTenantLock(tenant.id);
      tenantResults.push({ tenantId: tenant.id });
    } catch (error) {
      tenantResults.push({ tenantId: tenant.id, error: error instanceof Error ? error.message : "Reconciliation failed" });
    }
  }

  let routing: Awaited<ReturnType<typeof reconcilePhoneRouting>> | undefined;
  let routingError: string | undefined;
  try {
    routing = await reconcilePhoneRouting();
  } catch (error) {
    routingError = error instanceof Error ? error.message : "Routing reconciliation failed";
  }
  return { tenants: tenantResults, routing, routingError };
}
