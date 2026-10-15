import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { getAllLimitPolicies, setLimitPolicy, deleteLimitPolicy, getCurrentUsage } from "@/modules/limits";
import { writeAuditLog } from "@/modules/audit";
import { z } from "zod";
import { reconcileCallLimitForTenant } from "@/modules/call-limits";

const setLimitSchema = z.object({
  metric: z.enum(["AGENTS", "KNOWLEDGE_BASES", "CALL_MINUTES", "CALLS", "CONCURRENT_CALLS"]),
  limitValue: z.number().int().min(0),
  period: z.enum(["monthly", "lifetime"]).optional(),
  warnAtPct: z.number().int().min(0).max(100).optional(),
  mode: z.enum(["hard", "soft"]).optional(),
});

export const GET = withAdmin(async (_request: NextRequest, _session, { params }) => {
  const { tenantId } = params;
  const policies = await getAllLimitPolicies(tenantId);
  // AGENTS / KNOWLEDGE_BASES are not tracked in usageCounter, so read each
  // metric from the same live counts enforcement uses.
  const result = await Promise.all(
    policies.map(async (p) => ({
      ...p,
      currentUsage: await getCurrentUsage(tenantId, p.metric, p.period),
    }))
  );
  return NextResponse.json(result);
});

export const POST = withAdmin(async (request: NextRequest, session, { params }) => {
  const { tenantId } = params;
  const body = await request.json().catch(() => null);
  const parsed = setLimitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const policy = await setLimitPolicy(tenantId, parsed.data.metric as never, {
    limitValue: parsed.data.limitValue,
    period: parsed.data.period as "monthly" | "lifetime" | undefined,
    warnAtPct: parsed.data.warnAtPct,
    mode: parsed.data.mode as "hard" | "soft" | undefined,
  });

  let callAccess: Awaited<ReturnType<typeof reconcileCallLimitForTenant>> | { error: string } | undefined;
  if (parsed.data.metric === "CALL_MINUTES" || parsed.data.metric === "CALLS") {
    try {
      callAccess = await reconcileCallLimitForTenant(tenantId);
    } catch (error) {
      callAccess = { error: error instanceof Error ? error.message : "Call routing reconciliation failed" };
    }
  }

  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: "limit.set",
    targetType: "limit_policy",
    targetId: policy.id,
    tenantId,
    after: { metric: parsed.data.metric, limitValue: parsed.data.limitValue },
  });

  return NextResponse.json({ ...policy, ...(callAccess ? { callAccess } : {}) }, { status: 201 });
});

export const DELETE = withAdmin(async (request: NextRequest, session, { params }) => {
  const { tenantId } = params;
  const url = request.nextUrl;
  const metric = url.searchParams.get("metric");
  if (!metric) {
    return NextResponse.json({ error: "metric query param required" }, { status: 400 });
  }

  try {
    await deleteLimitPolicy(tenantId, metric as never);
  } catch {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  let callAccess: Awaited<ReturnType<typeof reconcileCallLimitForTenant>> | { error: string } | undefined;
  if (metric === "CALL_MINUTES" || metric === "CALLS") {
    try {
      callAccess = await reconcileCallLimitForTenant(tenantId);
    } catch (error) {
      callAccess = { error: error instanceof Error ? error.message : "Call routing reconciliation failed" };
    }
  }

  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: "limit.delete",
    targetType: "limit_policy",
    tenantId,
    after: { metric },
  });

  return NextResponse.json({ deleted: true, ...(callAccess ? { callAccess } : {}) });
}, "owner");
