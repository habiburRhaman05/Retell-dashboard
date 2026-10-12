import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { registerTenantSchema } from "@/modules/tenants/schemas";
import * as tenantService from "@/modules/tenants/service";
import { writeAuditLog } from "@/modules/audit";

export const GET = withAdmin(async () => {
  const tenants = await tenantService.listAllTenants();
  return NextResponse.json(tenants);
});

export const POST = withAdmin(async (request, session) => {
  const body = await request.json().catch(() => null);
  const parsed = registerTenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const tenant = await tenantService.registerTenant(parsed.data);

    await writeAuditLog({
      actorType: "admin",
      actorId: session.adminId,
      action: "tenant.create",
      targetType: "tenant",
      targetId: tenant.id,
      tenantId: tenant.id,
      after: { name: tenant.name, email: tenant.email, crmLocationId: tenant.crmLocationId },
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "DUPLICATE_LOCATION_ID") {
      return NextResponse.json(
        { error: "A tenant with this location ID already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
});
