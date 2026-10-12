import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { getAllFeatures, setFeatureEnabled } from "@/modules/enforcement";
import { writeAuditLog } from "@/modules/audit";
import { z } from "zod";

const toggleSchema = z.object({
  featureKey: z.string().min(1),
  enabled: z.boolean(),
  reason: z.string().nullable().optional(),
});

export const GET = withAdmin(async (_request: NextRequest, _session, { params }) => {
  const features = await getAllFeatures(params.tenantId);
  return NextResponse.json(features);
});

export const POST = withAdmin(async (request: NextRequest, session, { params }) => {
  const { tenantId } = params;
  const body = await request.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const feature = await setFeatureEnabled(
    tenantId,
    parsed.data.featureKey,
    parsed.data.enabled,
    parsed.data.reason ?? null,
    session.adminId
  );

  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: parsed.data.enabled ? "feature.enable" : "feature.disable",
    targetType: "tenant_feature",
    targetId: feature.id,
    tenantId,
    after: {
      featureKey: parsed.data.featureKey,
      enabled: parsed.data.enabled,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json(feature);
});
