import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { getAllLimitPolicies, setLimitPolicy, deleteLimitPolicy } from "@/modules/limits";
import { getUsageCounters } from "@/modules/usage";
import { writeAuditLog } from "@/modules/audit";
import { z } from "zod";

const setLimitSchema = z.object({
  metric: z.enum(["AGENTS", "KNOWLEDGE_BASES", "CALL_MINUTES", "CALLS", "CONCURRENT_CALLS"]),
  limitValue: z.number().int().min(0),
  period: z.enum(["monthly", "lifetime"]).optional(),
  warnAtPct: z.number().int().min(0).max(100).optional(),
  mode: z.enum(["hard", "soft"]).optional(),
});

export const GET = withAdmin(async (_request: NextRequest, _session, { params }) => {
  const { tenantId } = params;
  const [policies, counters] = await Promise.all([
    getAllLimitPolicies(tenantId),
    getUsageCounters(tenantId),
  ]);
  const counterMap = new Map(counters.map((c) => [c.metric, c.value]));
  const result = policies.map((p) => ({
    ...p,
    currentUsage: counterMap.get(p.metric) ?? 0,
  }));
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

  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: "limit.set",
    targetType: "limit_policy",
    targetId: policy.id,
    tenantId,
    after: { metric: parsed.data.metric, limitValue: parsed.data.limitValue },
  });

  return NextResponse.json(policy, { status: 201 });
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

  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: "limit.delete",
    targetType: "limit_policy",
    tenantId,
    after: { metric },
  });

  return NextResponse.json({ deleted: true });
}, "owner");
