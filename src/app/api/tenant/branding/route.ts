import { NextResponse } from "next/server";
import { withTenant } from "@/modules/auth/middleware";
import { getTenantById } from "@/modules/tenants";

// GET /api/tenant/branding - this tenant's own brand colors, derived purely
// from the signed-in session's tenantId (never from the client), for the
// dashboard to re-theme itself. Null values mean "use the app default".
export const GET = withTenant(async (_request, session) => {
  const tenant = await getTenantById(session.tenantId);
  if (!tenant) {
    return NextResponse.json({ brandPrimaryColor: null, brandSecondaryColor: null });
  }
  return NextResponse.json({
    brandPrimaryColor: tenant.brandPrimaryColor,
    brandSecondaryColor: tenant.brandSecondaryColor,
  });
});
