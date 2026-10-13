import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { createTenantLinkToken, TENANT_LINK_TTL_SEC } from "@/modules/auth/tokens";
import { writeAuditLog } from "@/modules/audit";
import { prisma } from "@/lib/prisma";

const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);

// NEXT_PUBLIC_APP_URL wins so a link made from a local admin can still point at
// production. But a localhost value copied into a live deployment must never
// leak into links, so then the address the admin is actually using is used.
function appBase(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  const origin = request.nextUrl.origin;
  if (configured && !(isLocal(configured) && !isLocal(origin))) return configured;
  return origin;
}

// Mints the signed dashboard link an admin pastes into the tenant's CRM menu.
// The link only ever opens that tenant's own dashboard.
export const POST = withAdmin(async (request: NextRequest, session, { params }) => {
  const { tenantId } = params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, crmLocationId: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const token = await createTenantLinkToken(tenant.crmLocationId);
  const base = appBase(request);
  const url = `${base}/retell/${encodeURIComponent(tenant.crmLocationId)}/dashboard?token=${token}`;

  // Never log the token itself: anyone holding it can open the dashboard.
  await writeAuditLog({
    actorType: "admin",
    actorId: session.adminId,
    action: "tenant.link_minted",
    targetType: "tenant",
    targetId: tenant.id,
    tenantId: tenant.id,
  });

  return NextResponse.json({
    url,
    expiresAt: new Date(Date.now() + TENANT_LINK_TTL_SEC * 1000).toISOString(),
  });
}, "owner");
