import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import * as tenantService from "@/modules/tenants/service";
import { writeAuditLog } from "@/modules/audit";

export const POST = withAdmin(async (_request, session, { params }) => {
  const tenant = await tenantService.getTenantById(params.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const updated = await tenantService.suspendTenant(params.tenantId);

  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: "tenant.suspend",
    targetType: "tenant",
    targetId: params.tenantId,
    tenantId: params.tenantId,
    before: { status: tenant.status },
    after: { status: "suspended" },
  });

  return NextResponse.json(updated);
}, "owner");

export const DELETE = withAdmin(async (_request, session, { params }) => {
  const tenant = await tenantService.getTenantById(params.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const updated = await tenantService.reactivateTenant(params.tenantId);

  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: "tenant.reactivate",
    targetType: "tenant",
    targetId: params.tenantId,
    tenantId: params.tenantId,
    before: { status: tenant.status },
    after: { status: "active" },
  });

  return NextResponse.json(updated);
}, "owner");
