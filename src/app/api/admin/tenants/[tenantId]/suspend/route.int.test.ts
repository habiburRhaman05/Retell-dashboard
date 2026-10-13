import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { POST, DELETE } from "./route";

const findTenant = vi.mocked(prisma.tenant.findUnique);
const updateTenant = vi.mocked(prisma.tenant.update);
const createAudit = vi.mocked(prisma.auditLog.create);

function ownerSession() {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin("owner") as never);
  return adminSessionToken("owner");
}

function supportSession() {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin("support") as never);
  return adminSessionToken("support");
}

function makeRequest(method: string) {
  return new NextRequest("http://localhost/api/admin/tenants/t1/suspend", { method });
}

const context = { params: Promise.resolve({ tenantId: "t1" }) };

const activeTenant = {
  id: "t1", name: "Acme", email: null, crmLocationId: "loc_1", status: "active",
};

const suspendedTenant = { ...activeTenant, status: "suspended" };

beforeEach(() => {
  vi.clearAllMocks();
  createAudit.mockResolvedValue({ id: "audit1" } as never);
});

describe("POST /api/admin/tenants/[tenantId]/suspend", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await POST(makeRequest("POST"), context);
    expect(res.status).toBe(401);
  });

  it("returns 403 for support role (owner-only)", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    const res = await POST(makeRequest("POST"), context);
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown tenant", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(null);
    const res = await POST(makeRequest("POST"), context);
    expect(res.status).toBe(404);
  });

  it("suspends tenant and writes audit log", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(activeTenant as never);
    updateTenant.mockResolvedValue(suspendedTenant as never);

    const res = await POST(makeRequest("POST"), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("suspended");
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "tenant.suspend",
        after: { status: "suspended" },
      }),
    });
  });
});

describe("DELETE /api/admin/tenants/[tenantId]/suspend", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await DELETE(makeRequest("DELETE"), context);
    expect(res.status).toBe(401);
  });

  it("returns 403 for support role (owner-only)", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    const res = await DELETE(makeRequest("DELETE"), context);
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown tenant", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), context);
    expect(res.status).toBe(404);
  });

  it("reactivates tenant and writes audit log", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(suspendedTenant as never);
    updateTenant.mockResolvedValue(activeTenant as never);

    const res = await DELETE(makeRequest("DELETE"), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("active");
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "tenant.reactivate",
        after: { status: "active" },
      }),
    });
  });
});
