import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    location: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { GET, PATCH } from "./route";

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

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/tenants/t1", {
    method,
    ...(body ? {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    } : {}),
  });
}

const context = { params: Promise.resolve({ tenantId: "t1" }) };

const existingTenant = {
  id: "t1", name: "Acme Corp", email: "acme@test.com",
  crmLocationId: "loc_1", status: "active",
  createdAt: new Date("2026-10-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  createAudit.mockResolvedValue({ id: "audit1" } as never);
});

describe("GET /api/admin/tenants/[tenantId]", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown tenant", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(404);
  });

  it("returns tenant for admin", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(existingTenant as never);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Acme Corp");
  });

  it("allows support role to view", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    findTenant.mockResolvedValue(existingTenant as never);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/admin/tenants/[tenantId]", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await PATCH(makeRequest("PATCH", { name: "New" }), context);
    expect(res.status).toBe(401);
  });

  it("returns 403 for support role", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    const res = await PATCH(makeRequest("PATCH", { name: "New" }), context);
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown tenant", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(null);
    const res = await PATCH(makeRequest("PATCH", { name: "New" }), context);
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid input", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(existingTenant as never);
    const res = await PATCH(makeRequest("PATCH", { name: "" }), context);
    expect(res.status).toBe(400);
  });

  it("updates tenant and writes audit log", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(existingTenant as never);
    updateTenant.mockResolvedValue({ ...existingTenant, name: "Updated Corp" } as never);

    const res = await PATCH(makeRequest("PATCH", { name: "Updated Corp" }), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Corp");
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "tenant.update",
        actorType: "admin",
      }),
    });
  });
});
