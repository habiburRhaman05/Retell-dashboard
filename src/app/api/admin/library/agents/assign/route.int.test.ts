import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    locationAgent: { findMany: vi.fn(), createMany: vi.fn() },
    privateRetellItem: { findMany: vi.fn() },
    location: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({
  listAllAgents: vi.fn(),
}));

vi.mock("@/modules/limits", () => ({
  checkLimitForLocation: vi.fn().mockResolvedValue({ status: "allow" }),
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
  headers: vi.fn(() => new Map()),
}));

import { prisma } from "@/lib/prisma";
import { listAllAgents } from "@/lib/retell-api";
import { checkLimitForLocation } from "@/modules/limits";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { POST } from "./route";

function signedInAs(role: "owner" | "support") {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin(role) as never);
  mockCookies.get.mockReturnValue({ value: adminSessionToken(role) });
}

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/library/agents/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAllAgents).mockResolvedValue([
    { agent_id: "a1", agent_name: "Agent 1", channel: "voice", last_modification_timestamp: 1 },
  ]);
  vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.locationAgent.createMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.location.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  vi.mocked(checkLimitForLocation).mockResolvedValue({ status: "allow" } as never);
});

describe("POST /api/admin/library/agents/assign", () => {
  it("returns 401 without session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await POST(makeRequest({ locationId: "loc1", retellIds: ["a1"] }), context);
    expect(res.status).toBe(401);
  });

  it("returns 403 for support (write operation)", async () => {
    signedInAs("support");
    const res = await POST(makeRequest({ locationId: "loc1", retellIds: ["a1"] }), context);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    signedInAs("owner");
    const res = await POST(makeRequest({ locationId: "" }), context);
    expect(res.status).toBe(400);
  });

  it("assigns agents and returns count", async () => {
    signedInAs("owner");
    const res = await POST(makeRequest({ locationId: "loc1", retellIds: ["a1"] }), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.assigned).toBe(1);
    expect(prisma.locationAgent.createMany).toHaveBeenCalled();
  });

  it("returns 403 LIMIT_REACHED when over limit", async () => {
    signedInAs("owner");
    vi.mocked(checkLimitForLocation).mockResolvedValue({
      status: "block",
      message: "Agent limit reached",
    } as never);

    const res = await POST(makeRequest({ locationId: "loc1", retellIds: ["a1"] }), context);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("LIMIT_REACHED");
  });
});
