import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
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

// Both the tenant dashboard and the admin panel are opened inside the CRM's frame,
// so in production their cookies must be third-party capable (SameSite=None;
// Secure; Partitioned). Locally, browsers drop SameSite=None without Secure, so
// use Lax there. Without SameSite protection, forged cross-site requests are
// stopped by crossSiteWrite() below instead.
function sessionCookieOptions(maxAge: number) {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? ("none" as const) : ("lax" as const),
    partitioned: prod,
    path: "/",
    maxAge,
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
  jar.set(TENANT_COOKIE, token, sessionCookieOptions(TENANT_SESSION_TTL_SEC));
}

// A browser can hold several cookies with the same name (an old one from an earlier
// version with another path or attributes, next to the current one), and sends them
// all. Reading just one could pick a stale cookie and lock the user out, so collect
// every value and let the caller use the first that verifies.
async function cookieValues(name: string): Promise<string[]> {
  const values: string[] = [];
  try {
    const header = (await headers()).get("cookie") ?? "";
    for (const part of header.split(";")) {
      const eq = part.indexOf("=");
      if (eq > 0 && part.slice(0, eq).trim() === name) values.push(part.slice(eq + 1).trim());
    }
  } catch {
    // no request headers available here; the cookie jar below still works
  }
  const jar = await cookies();
  const single = jar.get(name)?.value;
  if (single && !values.includes(single)) values.push(single);
  return values;
}

async function firstValidClaims(
  kind: "tenant-session" | "admin-session",
  name: string
): Promise<Record<string, string> | null> {
  for (const value of await cookieValues(name)) {
    const claims = await verifyToken(kind, value);
    if (claims) return claims;
  }
  return null;
}

/** The signed-in tenant from the cookie. Use withTenant/withTenantRoute for the live status check. */
export async function getTenantSession(): Promise<TenantSession | null> {
  const c = await firstValidClaims("tenant-session", TENANT_COOKIE);
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
  jar.set(ADMIN_COOKIE, token, sessionCookieOptions(ADMIN_SESSION_TTL_SEC));
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const c = await firstValidClaims("admin-session", ADMIN_COOKIE);
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

/**
 * CSRF guard for state-changing requests. Browsers always send an Origin header
 * on cross-site writes, so a write whose Origin is not this app is a forged
 * request from another website riding on the user's cookie. Requests without an
 * Origin (server-to-server, tools) are not browser CSRF and are let through.
 */
export function crossSiteWrite(request: NextRequest): NextResponse | null {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return null;
  const origin = request.headers.get("origin");
  if (!origin || origin === request.nextUrl.origin) return null;
  return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
}

/** 403 when a location id supplied by the client is not the signed-in tenant's own. */
export function locationMismatch(session: TenantSession, locationId: unknown): NextResponse | null {
  return typeof locationId === "string" && locationId !== session.crmLocationId ? denied() : null;
}

export function withTenant(handler: TenantHandler): (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> {
  return async (request, context) => {
    const forged = crossSiteWrite(request);
    if (forged) return forged;
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
    const forged = crossSiteWrite(request);
    if (forged) return forged;
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
    const forged = crossSiteWrite(request);
    if (forged) return forged;
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
