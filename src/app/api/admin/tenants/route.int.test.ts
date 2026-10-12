import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const findTenant = vi.mocked(prisma.tenant.findUnique);
const findMany = vi.mocked(prisma.tenant.findMany);
const createTenant = vi.mocked(prisma.tenant.create);
const createAudit = vi.mocked(prisma.auditLog.create);

function ownerSession() {
  return Buffer.from(JSON.stringify({
    adminId: "a1", email: "admin@test.com", role: "owner",
  })).toString("base64");
}

function supportSession() {
  return Buffer.from(JSON.stringify({
    adminId: "a2", email: "support@test.com", role: "support",
  })).toString("base64");
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/tenants", {
    method,
    ...(body ? {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    } : {}),
  });
}

const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  createAudit.mockResolvedValue({ id: "audit1" } as never);
});

describe("GET /api/admin/tenants", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(401);
  });

  it("returns tenant list for admin", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findMany.mockResolvedValue([{ id: "t1", name: "Acme" }] as never);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
  });

  it("allows support role to view", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    findMany.mockResolvedValue([] as never);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/tenants", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await POST(
      makeRequest("POST", { name: "New", crmLocationId: "loc_1" }),
      context
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for support role", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    const res = await POST(
      makeRequest("POST", { name: "New", crmLocationId: "loc_1" }),
      context
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid input", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const res = await POST(makeRequest("POST", { name: "" }), context);
    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate location ID", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue({ id: "existing" } as never);
    const res = await POST(
      makeRequest("POST", { name: "Dup", crmLocationId: "loc_1" }),
      context
    );
    expect(res.status).toBe(409);
  });

  it("creates tenant and writes audit log", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(null);
    createTenant.mockResolvedValue({
      id: "t_new",
      name: "New Corp",
      email: "a@b.com",
      crmLocationId: "loc_new",
      status: "active",
    } as never);

    const res = await POST(
      makeRequest("POST", { name: "New Corp", email: "a@b.com", crmLocationId: "loc_new" }),
      context
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("New Corp");
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "tenant.create",
        actorType: "admin",
      }),
    });
  });
});
