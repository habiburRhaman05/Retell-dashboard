import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    usageEvent: { findMany: vi.fn() },
    usageCounter: { findMany: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { GET } from "./route";

const findEvents = vi.mocked(prisma.usageEvent.findMany);
const findCounters = vi.mocked(prisma.usageCounter.findMany);

function ownerSession() {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin("owner") as never);
  return adminSessionToken("owner");
}

const context = { params: Promise.resolve({ tenantId: "t1" }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/tenants/[tenantId]/usage", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/usage");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("returns usage summary for admin", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findEvents.mockResolvedValue([]);
    findCounters.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/usage");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBeDefined();
    expect(data.counters).toBeDefined();
  });

  it("returns correct totals from events", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findEvents.mockResolvedValue([
      { durationSec: 120, costCents: 50, startedAt: new Date("2026-10-05"), agentId: "a1" },
      { durationSec: 60, costCents: 25, startedAt: new Date("2026-10-05"), agentId: "a1" },
    ] as never);
    findCounters.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/admin/tenants/t1/usage");
    const res = await GET(req, context);
    const data = await res.json();
    expect(data.summary.totalCalls).toBe(2);
    expect(data.summary.totalMinutes).toBe(3); // ceil(120/60)=2 + ceil(60/60)=1
    expect(data.summary.totalCostCents).toBe(75);
  });
});
