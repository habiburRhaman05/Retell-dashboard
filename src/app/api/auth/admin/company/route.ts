import { NextRequest, NextResponse } from "next/server";
import { verifyAdminByCompanyId } from "@/modules/auth/service";
import { setAdminSession } from "@/modules/auth/middleware";

// Auto-login for the admin panel link app.com/admin?companyId={id}. The
// companyId is an opaque random secret (see generateCompanyId in the auth
// module), not the admin's email or database id, so this is the admin
// equivalent of the tenant's signed dashboard link: whoever holds the value
// is signed in as that admin. Treat it like a password.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const companyId = typeof body?.companyId === "string" ? body.companyId.trim() : "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const session = await verifyAdminByCompanyId(companyId);
  if (!session) {
    return NextResponse.json({ error: "Invalid or unknown link" }, { status: 401 });
  }

  await setAdminSession(session);
  return NextResponse.json({ ok: true, role: session.role });
}
