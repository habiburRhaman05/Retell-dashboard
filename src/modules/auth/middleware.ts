import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { TenantSession, AdminSession } from "./service";

const TENANT_COOKIE = "tenant_session";
const ADMIN_COOKIE = "admin_session";

function encodeSession(data: object): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodeSession<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function setTenantSession(session: TenantSession): Promise<void> {
  const jar = await cookies();
  jar.set(TENANT_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getTenantSession(): Promise<TenantSession | null> {
  const jar = await cookies();
  const raw = jar.get(TENANT_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession<TenantSession>(raw);
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession<AdminSession>(raw);
}

export async function clearTenantSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(TENANT_COOKIE);
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export type TenantHandler<T = unknown> = (
  request: NextRequest,
  session: TenantSession,
  context: { params: Record<string, string> }
) => Promise<NextResponse<T>>;

export type AdminHandler<T = unknown> = (
  request: NextRequest,
  session: AdminSession,
  context: { params: Record<string, string> }
) => Promise<NextResponse<T>>;

export function withTenant(handler: TenantHandler): (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> {
  return async (request, context) => {
    const session = await getTenantSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (session.status === "suspended") {
      return NextResponse.json(
        { error: "This account is suspended. Contact support.", code: "ACCOUNT_SUSPENDED" },
        { status: 403 }
      );
    }
    const params = await context.params;
    const locationId = params.locationId;
    if (locationId && locationId !== session.crmLocationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return handler(request, session, { params });
  };
}

export function withAdmin(
  handler: AdminHandler,
  requiredRole?: "owner"
): (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> {
  return async (request, context) => {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
    }
    if (requiredRole === "owner" && session.role !== "owner") {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }
    if (request.method !== "GET" && session.role === "support") {
      return NextResponse.json({ error: "Read-only access" }, { status: 403 });
    }
    const params = await context.params;
    return handler(request, session, { params });
  };
}
