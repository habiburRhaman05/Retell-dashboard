import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenantFeature: { findMany: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const mockFeatures = vi.mocked(prisma.tenantFeature.findMany);
const mockFeatureUpsert = vi.mocked(prisma.tenantFeature.upsert);
const mockAudit = vi.mocked(prisma.auditLog.create);

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

const context = { params: Promise.resolve({ tenantId: "t1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAudit.mockResolvedValue({} as never);
});

describe("GET /api/admin/tenants/[tenantId]/features", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("returns features for admin", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const features = [
      { id: "f1", featureKey: "agents.create", enabled: true },
      { id: "f2", featureKey: "calls.make", enabled: false },
    ];
    mockFeatures.mockResolvedValue(features as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("support role can read features", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    mockFeatures.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/tenants/[tenantId]/features", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features", {
      method: "POST",
      body: JSON.stringify({ featureKey: "agents.create", enabled: false }),
    });
    const res = await POST(req, context);
    expect(res.status).toBe(401);
  });

  it("toggles a feature on", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const feature = { id: "f1", featureKey: "agents.create", enabled: true };
    mockFeatureUpsert.mockResolvedValue(feature as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features", {
      method: "POST",
      body: JSON.stringify({ featureKey: "agents.create", enabled: true }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(true);
    expect(mockAudit).toHaveBeenCalled();
  });

  it("toggles a feature off with reason", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const feature = { id: "f1", featureKey: "calls.make", enabled: false, reason: "Abuse" };
    mockFeatureUpsert.mockResolvedValue(feature as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features", {
      method: "POST",
      body: JSON.stringify({ featureKey: "calls.make", enabled: false, reason: "Abuse" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(false);
  });

  it("returns 400 for missing featureKey", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features", {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing enabled field", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features", {
      method: "POST",
      body: JSON.stringify({ featureKey: "agents.create" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
  });

  it("writes audit log with correct action for disable", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    mockFeatureUpsert.mockResolvedValue({ id: "f1" } as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features", {
      method: "POST",
      body: JSON.stringify({ featureKey: "agents.create", enabled: false }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, context);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "feature.disable",
        }),
      })
    );
  });

  it("writes audit log with correct action for enable", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    mockFeatureUpsert.mockResolvedValue({ id: "f1" } as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/features", {
      method: "POST",
      body: JSON.stringify({ featureKey: "agents.create", enabled: true }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, context);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "feature.enable",
        }),
      })
    );
  });
});
