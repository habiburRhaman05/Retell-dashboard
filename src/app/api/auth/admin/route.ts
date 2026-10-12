import { NextRequest, NextResponse } from "next/server";
import { verifyAdminLogin } from "@/modules/auth/service";
import { setAdminSession } from "@/modules/auth/middleware";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, password } = body ?? {};
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const session = await verifyAdminLogin(email, password);
  if (!session) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await setAdminSession(session);
  return NextResponse.json({ ok: true, role: session.role });
}
