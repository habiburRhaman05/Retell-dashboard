import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { TenantSession, AdminSession } from "./service";
import {
  ADMIN_SESSION_TTL_SEC,
  TENANT_SESSION_TTL_SEC,
  signToken,
  verifyToken,
} from "./tokens";

const TENANT_COOKIE = "tenant_session";
const ADMIN_COOKIE = "admin_session";

// The dashboard runs inside a CRM iframe, so in production the tenant cookie
// must be third-party capable (SameSite=None; Secure; Partitioned). Locally,
// browsers drop SameSite=None without Secure, so use Lax there.
function tenantCookieOptions() {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? ("none" as const) : ("lax" as const),
    partitioned: prod,
    path: "/",
    maxAge: TENANT_SESSION_TTL_SEC,
  };
}

export async function setTenantSession(session: TenantSession): Promise<void> {
  const jar = await cookies();
  const token = await signToken(
    "tenant-session",
    {
      tenantId: session.tenantId,
      crmLocationId: session.crmLocationId,
      tenantName: session.tenantName,
      status: session.status,
    },
    TENANT_SESSION_TTL_SEC
  );
  jar.set(TENANT_COOKIE, token, tenantCookieOptions());
}

/** The signed-in tenant from the cookie. Use withTenant/withTenantRoute for the live status check. */
export async function getTenantSession(): Promise<TenantSession | null> {
  const jar = await cookies();
  const raw = jar.get(TENANT_COOKIE)?.value;
  if (!raw) return null;
  const c = await verifyToken("tenant-session", raw);
  if (!c?.tenantId || !c.crmLocationId) return null;
  return {
    tenantId: c.tenantId,
    crmLocationId: c.crmLocationId,
    tenantName: c.tenantName ?? "",
    status: c.status === "suspended" ? "suspended" : "active",
  };
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const jar = await cookies();
  const token = await signToken(
    "admin-session",
    { adminId: session.adminId, email: session.email, role: session.role },
    ADMIN_SESSION_TTL_SEC
  );
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SEC,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return null;
  const c = await verifyToken("admin-session", raw);
  if (!c?.adminId || !c.email) return null;
  return {
    adminId: c.adminId,
    email: c.email,
    role: c.role === "owner" ? "owner" : "support",
  };
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

type AuthResult =
  | { session: TenantSession; response?: undefined }
  | { session?: undefined; response: NextResponse };

// A signed cookie proves who logged in, not that the tenant is still allowed
// in. Suspending (or deleting) a tenant must lock them out immediately, so the
// status and name always come from the database, never from the cookie.
async function authenticateTenant(): Promise<AuthResult> {
  const session = await getTenantSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  const live = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true, status: true, crmLocationId: true },
  });
  if (!live || live.crmLocationId !== session.crmLocationId) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  if (live.status === "suspended") {
    return {
      response: NextResponse.json(
        { error: "This account is suspended. Contact support.", code: "ACCOUNT_SUSPENDED" },
        { status: 403 }
      ),
    };
  }
  return { session: { ...session, tenantName: live.name, status: live.status } };
}

const denied = () => NextResponse.json({ error: "Access denied" }, { status: 403 });

/** 403 when a location id supplied by the client is not the signed-in tenant's own. */
export function locationMismatch(session: TenantSession, locationId: unknown): NextResponse | null {
  return typeof locationId === "string" && locationId !== session.crmLocationId ? denied() : null;
}

export function withTenant(handler: TenantHandler): (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> {
  return async (request, context) => {
    const auth = await authenticateTenant();
    if (auth.response) return auth.response;
    // Next passes params: undefined for routes with no dynamic segment.
    const params = (await context.params) ?? {};
    const mismatch = locationMismatch(auth.session, params.locationId);
    if (mismatch) return mismatch;
    return handler(request, auth.session, { params });
  };
}

/**
 * For routes that already take a Next-style (request, context) handler. The
 * tenant comes from the signed session; any `locationId` the client sends (in
 * the URL path, query string or JSON body) must equal it or the call is
 * rejected. Multipart routes must check their own form field with
 * locationMismatch(), since reading it here would buffer the upload twice.
 */
export function withTenantRoute<Ctx = { params: Promise<Record<string, string>> }>(
  handler: (request: NextRequest, context: Ctx, session: TenantSession) => Promise<Response>
): (request: NextRequest, context: Ctx) => Promise<Response> {
  return async (request, context) => {
    const auth = await authenticateTenant();
    if (auth.response) return auth.response;
    const { session } = auth;

    const pathParams = (await (context as { params?: Promise<Record<string, string>> })?.params) ?? {};
    const supplied: unknown[] = [
      pathParams.locationId,
      request.nextUrl.searchParams.get("locationId"),
    ];

    const type = request.headers.get("content-type") ?? "";
    if (request.method !== "GET" && request.method !== "HEAD" && type.includes("application/json")) {
      const body = await request.clone().json().catch(() => null);
      if (body && typeof body === "object") supplied.push((body as Record<string, unknown>).locationId);
    }

    for (const value of supplied) {
      const mismatch = locationMismatch(session, value);
      if (mismatch) return mismatch;
    }
    return handler(request, context, session);
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
    const signed = await getAdminSession();
    if (!signed) {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
    }
    // Same reasoning as tenants: a removed or demoted admin must lose access now.
    const live = await prisma.adminUser.findUnique({
      where: { id: signed.adminId },
      select: { email: true, role: true },
    });
    if (!live) {
      return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
    }
    const session: AdminSession = { adminId: signed.adminId, email: live.email, role: live.role };

    if (requiredRole === "owner" && session.role !== "owner") {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 });
    }
    if (request.method !== "GET" && session.role === "support") {
      return NextResponse.json({ error: "Read-only access" }, { status: 403 });
    }
    const params = (await context.params) ?? {};
    return handler(request, session, { params });
  };
}
