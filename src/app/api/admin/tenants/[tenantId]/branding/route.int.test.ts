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
  return new NextRequest("http://localhost/api/admin/tenants/t1/branding", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

const context = { params: Promise.resolve({ tenantId: "t1" }) };

const existingTenant = {
  id: "t1",
  name: "Acme Corp",
  brandPrimaryColor: null,
  brandSecondaryColor: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  createAudit.mockResolvedValue({ id: "audit1" } as never);
});

describe("GET /api/admin/tenants/[tenantId]/branding", () => {
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

  it("returns the current colors for an admin", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue({
      ...existingTenant,
      brandPrimaryColor: "#1d6bf3",
      brandSecondaryColor: "#1558d6",
    } as never);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ brandPrimaryColor: "#1d6bf3", brandSecondaryColor: "#1558d6" });
  });

  it("allows support role to view", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    findTenant.mockResolvedValue(existingTenant as never);
    const res = await GET(makeRequest("GET"), context);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/admin/tenants/[tenantId]/branding", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await PATCH(makeRequest("PATCH", { brandPrimaryColor: "#1d6bf3" }), context);
    expect(res.status).toBe(401);
  });

  it("returns 403 for support role", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    const res = await PATCH(makeRequest("PATCH", { brandPrimaryColor: "#1d6bf3" }), context);
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown tenant", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(null);
    const res = await PATCH(makeRequest("PATCH", { brandPrimaryColor: "#1d6bf3" }), context);
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid hex color", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(existingTenant as never);
    const res = await PATCH(makeRequest("PATCH", { brandPrimaryColor: "not-a-color" }), context);
    expect(res.status).toBe(400);
  });

  it("updates the colors and writes an audit log", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue(existingTenant as never);
    updateTenant.mockResolvedValue({
      ...existingTenant,
      brandPrimaryColor: "#1d6bf3",
      brandSecondaryColor: "#1558d6",
    } as never);

    const res = await PATCH(
      makeRequest("PATCH", { brandPrimaryColor: "#1d6bf3", brandSecondaryColor: "#1558d6" }),
      context
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ brandPrimaryColor: "#1d6bf3", brandSecondaryColor: "#1558d6" });
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "tenant.branding.update",
        actorType: "admin",
        tenantId: "t1",
      }),
    });
  });

  it("clears a color by sending null", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findTenant.mockResolvedValue({
      ...existingTenant,
      brandPrimaryColor: "#1d6bf3",
      brandSecondaryColor: "#1558d6",
    } as never);
    updateTenant.mockResolvedValue({
      ...existingTenant,
      brandPrimaryColor: "#1d6bf3",
      brandSecondaryColor: null,
    } as never);

    const res = await PATCH(makeRequest("PATCH", { brandSecondaryColor: null }), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.brandSecondaryColor).toBeNull();
  });
});
