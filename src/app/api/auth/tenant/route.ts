import { NextRequest, NextResponse } from "next/server";
import { verifyTenantAccess } from "@/modules/auth/service";
import { setTenantSession } from "@/modules/auth/middleware";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const locationId = body?.locationId;
  if (!locationId || typeof locationId !== "string") {
    return NextResponse.json({ error: "Location ID is required" }, { status: 400 });
  }

  const session = await verifyTenantAccess(locationId);
  if (!session) {
    return NextResponse.json(
      { error: "Account not registered. Contact support.", code: "NOT_REGISTERED" },
      { status: 403 }
    );
  }

  if (session.status === "suspended") {
    return NextResponse.json(
      { error: "This account is suspended. Contact support.", code: "ACCOUNT_SUSPENDED" },
      { status: 403 }
    );
  }

  await setTenantSession(session);
  return NextResponse.json({ ok: true, tenantName: session.tenantName });
}
