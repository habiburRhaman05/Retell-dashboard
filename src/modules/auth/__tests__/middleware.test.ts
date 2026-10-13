import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
const mockHeaders = vi.fn(async () => new Headers());
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
  headers: () => mockHeaders(),
}));

import { prisma } from "@/lib/prisma";
import {
  adminSessionToken,
  liveAdmin,
  liveTenant,
  signTestToken,
  tenantSessionToken,
} from "@/test/auth";
import {
  getAdminSession,
  getTenantSession,
  locationMismatch,
  crossSiteWrite,
  setAdminSession,
  setTenantSession,
  withAdmin,
  withTenant,
  withTenantRoute,
} from "../middleware";

const findTenant = vi.mocked(prisma.tenant.findUnique);
const findAdmin = vi.mocked(prisma.adminUser.findUnique);

const req = (path = "/api/tenant/entitlements", init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`http://localhost${path}`, init);

const signedIn = (token = tenantSessionToken()) => mockCookies.get.mockReturnValue({ value: token });

beforeEach(() => {
  vi.clearAllMocks();
  mockHeaders.mockResolvedValue(new Headers());
  findTenant.mockResolvedValue(liveTenant() as never);
  findAdmin.mockResolvedValue(liveAdmin() as never);
});

describe("session cookies", () => {
  it("stores the tenant session as a signed httpOnly cookie, not readable JSON", async () => {
    await setTenantSession({ tenantId: "t1", crmLocationId: "loc_1", tenantName: "Acme", status: "active" });

    const [name, value, options] = mockCookies.set.mock.calls[0];
    expect(name).toBe("tenant_session");
    expect(value.split(".")).toHaveLength(3);
    expect(value).not.toContain("loc_1");
    expect(options).toMatchObject({ httpOnly: true, path: "/" });
  });

  it("round-trips a tenant session through the cookie", async () => {
    await setTenantSession({ tenantId: "t1", crmLocationId: "loc_1", tenantName: "Acme", status: "active" });
    mockCookies.get.mockReturnValue({ value: mockCookies.set.mock.calls[0][1] });

    expect(await getTenantSession()).toEqual({
      tenantId: "t1",
      crmLocationId: "loc_1",
      tenantName: "Acme",
      status: "active",
    });
  });

  it("round-trips an admin session through the cookie", async () => {
    await setAdminSession({ adminId: "a1", email: "admin@test.com", role: "owner" });
    const [name, value, options] = mockCookies.set.mock.calls[0];
    expect(name).toBe("admin_session");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    mockCookies.get.mockReturnValue({ value });

    expect(await getAdminSession()).toEqual({ adminId: "a1", email: "admin@test.com", role: "owner" });
  });

  it("rejects the old unsigned base64 cookie", async () => {
    const forged = Buffer.from(
      JSON.stringify({ adminId: "a1", email: "x@y.z", role: "owner" })
    ).toString("base64");
    mockCookies.get.mockReturnValue({ value: forged });
    expect(await getAdminSession()).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    mockCookies.get.mockReturnValue({
      value: signTestToken(
        "admin-session",
        { adminId: "a1", email: "x@y.z", role: "owner" },
        { secret: "attacker-secret-attacker-secret-attacker" }
      ),
    });
    expect(await getAdminSession()).toBeNull();
  });

  it("rejects an expired cookie", async () => {
    const longAgo = Math.floor(Date.now() / 1000) - 7200;
    mockCookies.get.mockReturnValue({
      value: signTestToken(
        "tenant-session",
        { tenantId: "t1", crmLocationId: "loc_1", tenantName: "Acme", status: "active" },
        { nowSec: longAgo, ttlSec: 60 }
      ),
    });
    expect(await getTenantSession()).toBeNull();
  });

  it("does not accept a tenant cookie as an admin session or the reverse", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSessionToken() });
    expect(await getAdminSession()).toBeNull();
    mockCookies.get.mockReturnValue({ value: adminSessionToken() });
    expect(await getTenantSession()).toBeNull();
  });

  it("does not accept a dashboard link as a session", async () => {
    mockCookies.get.mockReturnValue({
      value: signTestToken("tenant-link", { loc: "loc_1", tenantId: "t1", crmLocationId: "loc_1" }),
    });
    expect(await getTenantSession()).toBeNull();
  });

  it("refuses to run without a strong SESSION_SECRET", async () => {
    const saved = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "short";
    try {
      mockCookies.get.mockReturnValue({ value: tenantSessionToken() });
      await expect(getTenantSession()).rejects.toThrow(/SESSION_SECRET/);
    } finally {
      process.env.SESSION_SECRET = saved;
    }
  });
});

describe("cookie attributes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("makes both session cookies frame-capable in production (SameSite=None; Secure; Partitioned)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await setTenantSession({ tenantId: "t1", crmLocationId: "loc_1", tenantName: "Acme", status: "active" });
    await setAdminSession({ adminId: "a1", email: "admin@test.com", role: "owner" });

    for (const [, , options] of mockCookies.set.mock.calls) {
      expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/" });
    }
  });

  it("uses Lax and no Secure/Partitioned locally, where browsers drop SameSite=None over http", async () => {
    await setAdminSession({ adminId: "a1", email: "admin@test.com", role: "owner" });
    expect(mockCookies.set.mock.calls[0][2]).toMatchObject({ secure: false, sameSite: "lax", partitioned: false });
  });
});

describe("crossSiteWrite (CSRF guard)", () => {
  const write = (method: string, origin?: string) =>
    req("/api/retell/agents", { method, headers: origin ? { origin } : {} });

  it("never blocks reads", () => {
    expect(crossSiteWrite(write("GET", "https://evil.example"))).toBeNull();
    expect(crossSiteWrite(write("HEAD", "https://evil.example"))).toBeNull();
  });

  it("allows writes from this app's own origin and requests with no Origin header", () => {
    expect(crossSiteWrite(write("POST", "http://localhost"))).toBeNull();
    expect(crossSiteWrite(write("POST"))).toBeNull();
  });

  it("blocks writes that another website sent with the user's cookie", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const res = crossSiteWrite(write(method, "https://evil.example"));
      expect(res?.status).toBe(403);
      expect(await res?.json()).toEqual({ error: "Cross-site request blocked" });
    }
  });

  it("is enforced by every wrapper before any session lookup or handler runs", async () => {
    signedIn();
    const hit = vi.fn(async () => NextResponse.json({ ok: true }));
    const evil = () => write("POST", "https://evil.example");

    expect((await withTenant(hit)(evil(), { params: Promise.resolve({}) })).status).toBe(403);
    expect((await withTenantRoute(hit)(evil(), { params: Promise.resolve({}) })).status).toBe(403);
    mockCookies.get.mockReturnValue({ value: adminSessionToken() });
    expect((await withAdmin(hit)(evil(), { params: Promise.resolve({}) })).status).toBe(403);
    expect(hit).not.toHaveBeenCalled();
    expect(findTenant).not.toHaveBeenCalled();
    expect(findAdmin).not.toHaveBeenCalled();
  });

  it("lets a same-origin write through the wrappers", async () => {
    signedIn();
    const hit = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withTenantRoute(hit)(write("POST", "http://localhost"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });
});

describe("duplicate cookies with the same name", () => {
  const legacy = (payload: object) => Buffer.from(JSON.stringify(payload)).toString("base64");
  const withCookieHeader = (header: string) => mockHeaders.mockResolvedValue(new Headers({ cookie: header }));

  it("uses the valid tenant cookie even when a stale legacy one is sent first", async () => {
    const old = legacy({ tenantId: "t1", crmLocationId: "loc_1" });
    withCookieHeader(`tenant_session=${old}; other=1; tenant_session=${tenantSessionToken()}`);
    mockCookies.get.mockReturnValue({ value: old }); // the jar only exposes one of them

    expect(await getTenantSession()).toMatchObject({ tenantId: "t1", crmLocationId: "loc_1" });
  });

  it("uses the valid admin cookie even when a stale legacy one is sent first", async () => {
    const old = legacy({ adminId: "a1", email: "x@y.z", role: "owner" });
    withCookieHeader(`admin_session=${old}; admin_session=${adminSessionToken("support")}`);
    mockCookies.get.mockReturnValue({ value: old });

    expect(await getAdminSession()).toMatchObject({ adminId: "a1", role: "support" });
  });

  it("still rejects when every cookie of that name is invalid", async () => {
    withCookieHeader(`tenant_session=${legacy({ tenantId: "t1" })}; tenant_session=garbage`);
    mockCookies.get.mockReturnValue({ value: "garbage" });
    expect(await getTenantSession()).toBeNull();
  });

  it("does not mistake a differently named cookie for the session", async () => {
    withCookieHeader(`my_tenant_session=${tenantSessionToken()}`);
    mockCookies.get.mockReturnValue(undefined);
    expect(await getTenantSession()).toBeNull();
  });

  it("falls back to the cookie jar when request headers are unavailable", async () => {
    mockHeaders.mockRejectedValue(new Error("outside a request"));
    mockCookies.get.mockReturnValue({ value: tenantSessionToken() });
    expect(await getTenantSession()).toMatchObject({ tenantId: "t1" });
  });
});

describe("withTenant", () => {
  it("runs the handler on routes with no dynamic params", async () => {
    // Next 16 passes context.params as undefined when the route has no
    // dynamic segment; the wrapper must not dereference it.
    signedIn();
    const handler = withTenant(async (_request, session) =>
      NextResponse.json({ tenantId: session.tenantId })
    );

    const res = await handler(req(), { params: undefined as never });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenantId: "t1" });
  });

  it("returns 401 without a session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const handler = withTenant(async () => NextResponse.json({ ok: true }));

    const res = await handler(req(), { params: undefined as never });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a forged cookie", async () => {
    mockCookies.get.mockReturnValue({ value: "not.a.token" });
    const handler = withTenant(async () => NextResponse.json({ ok: true }));
    expect((await handler(req(), { params: undefined as never })).status).toBe(401);
  });

  it("blocks a tenant suspended after they signed in, using the live database status", async () => {
    signedIn(); // the cookie still says active
    findTenant.mockResolvedValue(liveTenant({ status: "suspended" }) as never);
    const handler = withTenant(async () => NextResponse.json({ ok: true }));

    const res = await handler(req(), { params: undefined as never });

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ACCOUNT_SUSPENDED");
  });

  it("returns 401 when the tenant no longer exists", async () => {
    signedIn();
    findTenant.mockResolvedValue(null);
    const handler = withTenant(async () => NextResponse.json({ ok: true }));
    expect((await handler(req(), { params: undefined as never })).status).toBe(401);
  });

  it("returns 401 when the tenant's location changed since the cookie was issued", async () => {
    signedIn();
    findTenant.mockResolvedValue(liveTenant({ crmLocationId: "loc_other" }) as never);
    const handler = withTenant(async () => NextResponse.json({ ok: true }));
    expect((await handler(req(), { params: undefined as never })).status).toBe(401);
  });

  it("hands the handler the live tenant name, not the cookie's", async () => {
    signedIn();
    findTenant.mockResolvedValue(liveTenant({ name: "Renamed Co" }) as never);
    const handler = withTenant(async (_r, session) => NextResponse.json({ name: session.tenantName }));
    const res = await handler(req(), { params: undefined as never });
    expect(await res.json()).toEqual({ name: "Renamed Co" });
  });

  it("denies a location other than the session's own", async () => {
    signedIn();
    const handler = withTenant(async () => NextResponse.json({ ok: true }));

    const res = await handler(req(), {
      params: Promise.resolve({ locationId: "other_loc" }),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Access denied" });
  });
});

describe("withTenantRoute", () => {
  const ok = vi.fn<(request: NextRequest, context: unknown, session: unknown) => Promise<NextResponse>>(
    async () => NextResponse.json({ ok: true })
  );
  const handler = withTenantRoute(ok);
  const noParams = { params: Promise.resolve({}) };
  const jsonPost = (body: unknown, path = "/api/retell/agents") =>
    req(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  beforeEach(() => ok.mockClear());

  it("returns 401 without a session and never runs the handler", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await handler(req("/api/retell/agents?locationId=loc_1"), noParams);
    expect(res.status).toBe(401);
    expect(ok).not.toHaveBeenCalled();
  });

  it("blocks a suspended tenant from every wrapped route", async () => {
    signedIn();
    findTenant.mockResolvedValue(liveTenant({ status: "suspended" }) as never);
    const res = await handler(req("/api/retell/agents?locationId=loc_1"), noParams);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ACCOUNT_SUSPENDED");
    expect(ok).not.toHaveBeenCalled();
  });

  it("allows the tenant's own locationId in the query string and passes the session on", async () => {
    signedIn();
    const res = await handler(req("/api/retell/agents?locationId=loc_1"), noParams);
    expect(res.status).toBe(200);
    expect(ok.mock.calls[0][2]).toMatchObject({ tenantId: "t1", crmLocationId: "loc_1" });
  });

  it("rejects another tenant's locationId in the query string", async () => {
    signedIn();
    const res = await handler(req("/api/retell/agents?locationId=loc_victim"), noParams);
    expect(res.status).toBe(403);
    expect(ok).not.toHaveBeenCalled();
  });

  it("rejects another tenant's locationId in a JSON body, and the handler can still read the body when it matches", async () => {
    signedIn();
    expect((await handler(jsonPost({ locationId: "loc_victim" }), noParams)).status).toBe(403);
    expect(ok).not.toHaveBeenCalled();

    const mine = jsonPost({ locationId: "loc_1", name: "x" });
    expect((await handler(mine, noParams)).status).toBe(200);
    // the wrapper only peeked at a clone, so the handler's own read still works
    expect(await ok.mock.calls[0][0].json()).toEqual({ locationId: "loc_1", name: "x" });
  });

  it("rejects another tenant's locationId in the URL path", async () => {
    signedIn();
    const res = await handler(req("/api/locations/loc_victim"), {
      params: Promise.resolve({ locationId: "loc_victim" }),
    });
    expect(res.status).toBe(403);
  });

  it("works for routes with no dynamic segment (params undefined)", async () => {
    signedIn();
    const res = await handler(req("/api/retell/voices"), undefined as never);
    expect(res.status).toBe(200);
  });

  it("ignores a body that is not JSON or has no locationId", async () => {
    signedIn();
    const text = req("/api/retell/agents", { method: "POST", headers: { "content-type": "application/json" }, body: "not json" });
    expect((await handler(text, noParams)).status).toBe(200);
    expect((await handler(jsonPost({ name: "x" }), noParams)).status).toBe(200);
  });
});

describe("locationMismatch", () => {
  const session = { tenantId: "t1", crmLocationId: "loc_1", tenantName: "Acme", status: "active" as const };

  it("passes the tenant's own location and values that are not supplied", () => {
    expect(locationMismatch(session, "loc_1")).toBeNull();
    expect(locationMismatch(session, undefined)).toBeNull();
    expect(locationMismatch(session, null)).toBeNull();
  });

  it("returns 403 for any other location", () => {
    expect(locationMismatch(session, "loc_2")?.status).toBe(403);
    expect(locationMismatch(session, "")?.status).toBe(403);
  });
});

describe("withAdmin", () => {
  it("passes params through when none exist", async () => {
    mockCookies.get.mockReturnValue({ value: adminSessionToken() });
    const handler = withAdmin(async (_request, _session, { params }) =>
      NextResponse.json({ params })
    );

    const res = await handler(
      new NextRequest("http://localhost/api/admin/tenants"),
      { params: undefined as never }
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ params: {} });
  });

  it("returns 401 for a forged admin cookie", async () => {
    mockCookies.get.mockReturnValue({
      value: Buffer.from(JSON.stringify({ adminId: "a1", email: "x@y.z", role: "owner" })).toString("base64"),
    });
    const handler = withAdmin(async () => NextResponse.json({ ok: true }));
    const res = await handler(new NextRequest("http://localhost/api/admin/tenants"), { params: undefined as never });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the admin was removed after signing in", async () => {
    mockCookies.get.mockReturnValue({ value: adminSessionToken() });
    findAdmin.mockResolvedValue(null);
    const handler = withAdmin(async () => NextResponse.json({ ok: true }));
    const res = await handler(new NextRequest("http://localhost/api/admin/tenants"), { params: undefined as never });
    expect(res.status).toBe(401);
  });

  it("uses the live role, so a demoted owner loses owner access at once", async () => {
    mockCookies.get.mockReturnValue({ value: adminSessionToken("owner") }); // cookie still says owner
    findAdmin.mockResolvedValue(liveAdmin("support") as never);
    const handler = withAdmin(async () => NextResponse.json({ ok: true }), "owner");

    const res = await handler(
      new NextRequest("http://localhost/api/admin/tenants/t1/limits"),
      { params: Promise.resolve({ tenantId: "t1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("still enforces the owner role", async () => {
    mockCookies.get.mockReturnValue({ value: adminSessionToken("support") });
    findAdmin.mockResolvedValue(liveAdmin("support") as never);
    const handler = withAdmin(async () => NextResponse.json({ ok: true }), "owner");

    const res = await handler(
      new NextRequest("http://localhost/api/admin/tenants/t1/limits"),
      { params: Promise.resolve({ tenantId: "t1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("keeps support read-only", async () => {
    mockCookies.get.mockReturnValue({ value: adminSessionToken("support") });
    findAdmin.mockResolvedValue(liveAdmin("support") as never);
    const handler = withAdmin(async () => NextResponse.json({ ok: true }));

    const res = await handler(
      new NextRequest("http://localhost/api/admin/tenants", { method: "POST" }),
      { params: undefined as never }
    );

    expect(res.status).toBe(403);
  });
});
