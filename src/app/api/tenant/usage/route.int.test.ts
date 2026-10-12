import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usageEvent: { findMany: vi.fn() },
    usageCounter: { findMany: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const findEvents = vi.mocked(prisma.usageEvent.findMany);
const findCounters = vi.mocked(prisma.usageCounter.findMany);

function tenantSession() {
  return Buffer.from(JSON.stringify({
    tenantId: "t1", crmLocationId: "loc_1", tenantName: "Acme", status: "active",
  })).toString("base64");
}

const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tenant/usage", () => {
  it("returns 401 without tenant session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/tenant/usage");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("returns usage for authenticated tenant", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    findEvents.mockResolvedValue([]);
    findCounters.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/tenant/usage");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary.totalCalls).toBe(0);
    expect(data.summary.totalMinutes).toBe(0);
  });

  it("scopes data to the authenticated tenant", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    findEvents.mockResolvedValue([
      { durationSec: 300, costCents: 100, startedAt: new Date("2026-10-10"), agentId: "a1" },
    ] as never);
    findCounters.mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/tenant/usage");
    const res = await GET(req, context);
    const data = await res.json();
    expect(data.summary.totalCalls).toBe(1);
    expect(findEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
  });
});
