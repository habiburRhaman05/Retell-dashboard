import { NextRequest, NextResponse } from "next/server";
import { verifyTenantAccess } from "@/modules/auth/service";
import { getTenantSession, setTenantSession } from "@/modules/auth/middleware";
import { verifyTenantLinkToken } from "@/modules/auth/tokens";

// A tenant gets in only two ways: a signed link minted by an admin (carried in
// `token`), or a session cookie that an earlier link already created. Knowing
// or guessing a location id is never enough.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const locationId = body?.locationId;
  const token = body?.token;
  if (!locationId || typeof locationId !== "string") {
    return NextResponse.json({ error: "Location ID is required" }, { status: 400 });
  }

  const usingLink = typeof token === "string" && token.length > 0;
  if (usingLink) {
    const linkedLocation = await verifyTenantLinkToken(token);
    if (!linkedLocation || linkedLocation !== locationId) {
      return NextResponse.json(
        { error: "This link is not valid. Ask support for a new one.", code: "INVALID_LINK" },
        { status: 401 }
      );
    }
  } else {
    const existing = await getTenantSession();
    if (!existing || existing.crmLocationId !== locationId) {
      return NextResponse.json(
        { error: "Open this app from your CRM link.", code: "LINK_REQUIRED" },
        { status: 401 }
      );
    }
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

  if (usingLink) await setTenantSession(session);
  return NextResponse.json({ ok: true, tenantName: session.tenantName });
}
