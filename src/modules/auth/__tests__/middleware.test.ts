import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { withTenant, withAdmin } from "../middleware";

function tenantSession(status = "active") {
  return Buffer.from(
    JSON.stringify({
      tenantId: "t1",
      crmLocationId: "loc_1",
      tenantName: "Acme",
      status,
    })
  ).toString("base64");
}

function adminSession(role = "owner") {
  return Buffer.from(
    JSON.stringify({ adminId: "a1", email: "admin@test.com", role })
  ).toString("base64");
}

const req = () => new NextRequest("http://localhost/api/tenant/entitlements");

beforeEach(() => vi.clearAllMocks());

describe("withTenant", () => {
  it("runs the handler on routes with no dynamic params", async () => {
    // Next 16 passes context.params as undefined when the route has no
    // dynamic segment; the wrapper must not dereference it.
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    const handler = withTenant(async (_request, session) =>
      NextResponse.json({ tenantId: session.tenantId })
    );

    const res = await handler(req(), { params: undefined as never });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenantId: "t1" });
  });

  it("still returns 401 without a session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const handler = withTenant(async () => NextResponse.json({ ok: true }));

    const res = await handler(req(), { params: undefined as never });

    expect(res.status).toBe(401);
  });

  it("still blocks suspended tenants", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession("suspended") });
    const handler = withTenant(async () => NextResponse.json({ ok: true }));

    const res = await handler(req(), { params: undefined as never });

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ACCOUNT_SUSPENDED");
  });

  it("still denies a location other than the session's own", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    const handler = withTenant(async () => NextResponse.json({ ok: true }));

    const res = await handler(req(), {
      params: Promise.resolve({ locationId: "other_loc" }),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Access denied" });
  });
});

describe("withAdmin", () => {
  it("passes params through when none exist", async () => {
    mockCookies.get.mockReturnValue({ value: adminSession() });
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

  it("still enforces the owner role", async () => {
    mockCookies.get.mockReturnValue({ value: adminSession("support") });
    const handler = withAdmin(async () => NextResponse.json({ ok: true }), "owner");

    const res = await handler(
      new NextRequest("http://localhost/api/admin/tenants/t1/limits"),
      { params: Promise.resolve({ tenantId: "t1" }) }
    );

    expect(res.status).toBe(403);
  });
});
