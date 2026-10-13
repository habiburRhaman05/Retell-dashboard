import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { verifyTenantLinkToken } from "@/modules/auth/tokens";
import { POST } from "./route";

const findTenant = vi.mocked(prisma.tenant.findUnique);
const createAudit = vi.mocked(prisma.auditLog.create);

function signedInAs(role: "owner" | "support") {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin(role) as never);
  mockCookies.get.mockReturnValue({ value: adminSessionToken(role) });
}

const context = { params: Promise.resolve({ tenantId: "t1" }) };
const request = () => new NextRequest("http://localhost:3000/api/admin/tenants/t1/link", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  createAudit.mockResolvedValue({} as never);
  findTenant.mockResolvedValue({ id: "t1", crmLocationId: "loc_1" } as never);
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("POST /api/admin/tenants/[tenantId]/link", () => {
  it("returns 401 without an admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    expect((await POST(request(), context)).status).toBe(401);
  });

  it("is owner-only: support gets 403 and no link is made", async () => {
    signedInAs("support");
    const res = await POST(request(), context);
    expect(res.status).toBe(403);
    expect(findTenant).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown tenant", async () => {
    signedInAs("owner");
    findTenant.mockResolvedValue(null);
    expect((await POST(request(), context)).status).toBe(404);
  });

  it("mints a signed link that opens exactly that tenant's dashboard", async () => {
    signedInAs("owner");

    const res = await POST(request(), context);

    expect(res.status).toBe(200);
    const { url, expiresAt } = await res.json();
    const parsed = new URL(url);
    expect(parsed.origin).toBe("http://localhost:3000");
    expect(parsed.pathname).toBe("/retell/loc_1/dashboard");
    expect(await verifyTenantLinkToken(parsed.searchParams.get("token")!)).toBe("loc_1");
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("uses NEXT_PUBLIC_APP_URL as the base when set, without a trailing slash", async () => {
    signedInAs("owner");
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";

    const { url } = await (await POST(request(), context)).json();

    expect(url.startsWith("https://app.example.com/retell/loc_1/dashboard?token=")).toBe(true);
  });

  it("ignores a localhost NEXT_PUBLIC_APP_URL when the admin is on the live site", async () => {
    signedInAs("owner");
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    const live = new NextRequest("https://retell-dashboard-delta.vercel.app/api/admin/tenants/t1/link", { method: "POST" });
    const { url } = await (await POST(live, context)).json();

    expect(url.startsWith("https://retell-dashboard-delta.vercel.app/retell/loc_1/dashboard?token=")).toBe(true);
  });

  it("keeps a localhost NEXT_PUBLIC_APP_URL when the admin is local too", async () => {
    signedInAs("owner");
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    const { url } = await (await POST(request(), context)).json();
    expect(url.startsWith("http://localhost:3000/retell/loc_1/dashboard?token=")).toBe(true);
  });

  it("lets a local admin make production links when NEXT_PUBLIC_APP_URL is the live address", async () => {
    signedInAs("owner");
    process.env.NEXT_PUBLIC_APP_URL = "https://retell-dashboard-delta.vercel.app";
    const { url } = await (await POST(request(), context)).json();
    expect(url.startsWith("https://retell-dashboard-delta.vercel.app/retell/loc_1/dashboard?token=")).toBe(true);
  });

  it("audits the action without writing the token anywhere", async () => {
    signedInAs("owner");

    const { url } = await (await POST(request(), context)).json();

    const logged = JSON.stringify(createAudit.mock.calls[0][0]);
    expect(logged).toContain("tenant.link_minted");
    expect(logged).not.toContain(new URL(url).searchParams.get("token")!);
  });
});
