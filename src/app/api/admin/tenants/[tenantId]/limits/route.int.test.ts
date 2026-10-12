import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    limitPolicy: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    usageCounter: { findUnique: vi.fn(), findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
    locationAgent: { count: vi.fn() },
    locationKnowledgeBase: { count: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { GET, POST, DELETE } from "./route";

const mockPolicies = vi.mocked(prisma.limitPolicy.findMany);
const mockPolicyUpsert = vi.mocked(prisma.limitPolicy.upsert);
const mockPolicyDelete = vi.mocked(prisma.limitPolicy.delete);
const mockTenant = vi.mocked(prisma.tenant.findUnique);
const mockAgentCount = vi.mocked(prisma.locationAgent.count);
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

describe("GET /api/admin/tenants/[tenantId]/limits", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("returns policies with current usage for admin", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    mockPolicies.mockResolvedValue([
      { id: "p1", metric: "AGENTS", limitValue: 10, tenantId: "t1" },
    ] as never);
    // agent usage is counted from locationAgent, not from usageCounter
    mockTenant.mockResolvedValue({ crmLocationId: "loc_1" } as never);
    mockAgentCount.mockResolvedValue(5 as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].currentUsage).toBe(5);
  });

  it("support role can read limits", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    mockPolicies.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/tenants/[tenantId]/limits", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits", {
      method: "POST",
      body: JSON.stringify({ metric: "AGENTS", limitValue: 10 }),
    });
    const res = await POST(req, context);
    expect(res.status).toBe(401);
  });

  it("creates a limit policy with valid input", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const policy = { id: "p1", tenantId: "t1", metric: "AGENTS", limitValue: 10 };
    mockPolicyUpsert.mockResolvedValue(policy as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits", {
      method: "POST",
      body: JSON.stringify({ metric: "AGENTS", limitValue: 10 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.metric).toBe("AGENTS");
    expect(mockAudit).toHaveBeenCalled();
  });

  it("returns 400 for invalid metric", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits", {
      method: "POST",
      body: JSON.stringify({ metric: "INVALID", limitValue: 10 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing limitValue", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits", {
      method: "POST",
      body: JSON.stringify({ metric: "AGENTS" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative limitValue", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits", {
      method: "POST",
      body: JSON.stringify({ metric: "AGENTS", limitValue: -5 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
  });

  it("accepts optional period, warnAtPct, and mode", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    mockPolicyUpsert.mockResolvedValue({ id: "p1" } as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits", {
      method: "POST",
      body: JSON.stringify({
        metric: "CALL_MINUTES",
        limitValue: 500,
        period: "lifetime",
        warnAtPct: 90,
        mode: "soft",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, context);
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/admin/tenants/[tenantId]/limits", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits?metric=AGENTS", {
      method: "DELETE",
    });
    const res = await DELETE(req, context);
    expect(res.status).toBe(401);
  });

  it("requires owner role", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits?metric=AGENTS", {
      method: "DELETE",
    });
    const res = await DELETE(req, context);
    expect(res.status).toBe(403);
  });

  it("deletes policy as owner", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    mockPolicyDelete.mockResolvedValue({} as never);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits?metric=AGENTS", {
      method: "DELETE",
    });
    const res = await DELETE(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
    expect(mockAudit).toHaveBeenCalled();
  });

  it("returns 400 when metric param is missing", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits", {
      method: "DELETE",
    });
    const res = await DELETE(req, context);
    expect(res.status).toBe(400);
  });

  it("returns 404 when policy does not exist", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    mockPolicyDelete.mockRejectedValue(new Error("Record to delete not found"));
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/limits?metric=AGENTS", {
      method: "DELETE",
    });
    const res = await DELETE(req, context);
    expect(res.status).toBe(404);
  });
});
