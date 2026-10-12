import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    limitPolicy: { findMany: vi.fn() },
    featureLock: { findMany: vi.fn() },
    tenantFeature: { findMany: vi.fn() },
    usageCounter: { findUnique: vi.fn(), findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
    locationAgent: { count: vi.fn() },
    locationKnowledgeBase: { count: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const mockPolicies = vi.mocked(prisma.limitPolicy.findMany);
const mockLocks = vi.mocked(prisma.featureLock.findMany);
const mockFeatures = vi.mocked(prisma.tenantFeature.findMany);
const mockCounters = vi.mocked(prisma.usageCounter.findUnique);
const mockTenant = vi.mocked(prisma.tenant.findUnique);
const mockAgentCount = vi.mocked(prisma.locationAgent.count);
const mockKbCount = vi.mocked(prisma.locationKnowledgeBase.count);

function tenantSession() {
  return Buffer.from(JSON.stringify({
    tenantId: "t1", crmLocationId: "loc_1", tenantName: "Acme", status: "active",
  })).toString("base64");
}

const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  // usage comes from live counts: an empty tenant has no agents or KBs and
  // no call counters for the current period
  mockTenant.mockResolvedValue({ crmLocationId: "loc_1" } as never);
  mockAgentCount.mockResolvedValue(0 as never);
  mockKbCount.mockResolvedValue(0 as never);
  mockCounters.mockResolvedValue(null as never);
});

describe("GET /api/tenant/entitlements", () => {
  it("returns 401 without tenant session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/tenant/entitlements");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("returns all feature entitlements for authenticated tenant", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    mockPolicies.mockResolvedValue([]);
    mockLocks.mockResolvedValue([]);
    mockFeatures.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/tenant/entitlements");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data["agents.create"]).toBeDefined();
    expect(data["knowledge_bases.create"]).toBeDefined();
    expect(data["calls.make"]).toBeDefined();
    expect(data["calls.minutes"]).toBeDefined();
  });

  it("all features default to ok status with no policies", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    mockPolicies.mockResolvedValue([]);
    mockLocks.mockResolvedValue([]);
    mockFeatures.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/tenant/entitlements");
    const res = await GET(req, context);
    const data = await res.json();
    for (const key of Object.keys(data)) {
      expect(data[key].status).toBe("ok");
      expect(data[key].enabled).toBe(true);
    }
  });

  it("marks feature as blocked when disabled by admin", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    mockPolicies.mockResolvedValue([]);
    mockLocks.mockResolvedValue([]);
    mockFeatures.mockResolvedValue([
      { featureKey: "agents.create", enabled: false, reason: "Admin disabled" },
    ] as never);
    const req = new NextRequest("http://localhost/api/tenant/entitlements");
    const res = await GET(req, context);
    const data = await res.json();
    expect(data["agents.create"].status).toBe("blocked");
    expect(data["agents.create"].enabled).toBe(false);
  });

  it("marks feature as blocked when a lock exists", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    mockPolicies.mockResolvedValue([]);
    mockLocks.mockResolvedValue([
      { featureKey: "calls.make", metric: "CALLS", reason: "Limit" },
    ] as never);
    mockFeatures.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/tenant/entitlements");
    const res = await GET(req, context);
    const data = await res.json();
    expect(data["calls.make"].status).toBe("blocked");
    expect(data["calls.make"].enabled).toBe(false);
  });

  it("shows warning when usage reaches warn threshold", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    mockPolicies.mockResolvedValue([
      { metric: "CALLS", limitValue: 100, warnAtPct: 80 },
    ] as never);
    mockLocks.mockResolvedValue([]);
    mockFeatures.mockResolvedValue([]);
    mockCounters.mockResolvedValue({ metric: "CALLS", value: 85 } as never);
    const req = new NextRequest("http://localhost/api/tenant/entitlements");
    const res = await GET(req, context);
    const data = await res.json();
    expect(data["calls.make"].status).toBe("warning");
    expect(data["calls.make"].used).toBe(85);
    expect(data["calls.make"].limit).toBe(100);
  });

  it("shows blocked when usage exceeds limit", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    mockPolicies.mockResolvedValue([
      { metric: "AGENTS", limitValue: 5, warnAtPct: 80 },
    ] as never);
    mockLocks.mockResolvedValue([]);
    mockFeatures.mockResolvedValue([]);
    // agents are counted from locationAgent, not from usageCounter
    mockAgentCount.mockResolvedValue(5 as never);
    const req = new NextRequest("http://localhost/api/tenant/entitlements");
    const res = await GET(req, context);
    const data = await res.json();
    expect(data["agents.create"].status).toBe("blocked");
  });
});
