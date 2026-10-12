import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { updateTenantSchema } from "@/modules/tenants/schemas";
import * as tenantService from "@/modules/tenants/service";
import { writeAuditLog } from "@/modules/audit";

export const GET = withAdmin(async (_request, _session, { params }) => {
  const tenant = await tenantService.getTenantById(params.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  return NextResponse.json(tenant);
});

export const PATCH = withAdmin(async (request, session, { params }) => {
  const tenant = await tenantService.getTenantById(params.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const before = { name: tenant.name, email: tenant.email };
  const updated = await tenantService.updateTenant(params.tenantId, parsed.data);

  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: "tenant.update",
    targetType: "tenant",
    targetId: params.tenantId,
    tenantId: params.tenantId,
    before,
    after: { name: updated.name, email: updated.email },
  });

  return NextResponse.json(updated);
});
