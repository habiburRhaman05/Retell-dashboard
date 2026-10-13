import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    locationKnowledgeBase: { findMany: vi.fn(), createMany: vi.fn() },
    privateRetellItem: { findMany: vi.fn() },
    location: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({
  listKnowledgeBases: vi.fn(),
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
import { listKnowledgeBases } from "@/lib/retell-api";
import { checkLimitForLocation } from "@/modules/limits";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { POST } from "./route";

function signedInAs(role: "owner" | "support") {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin(role) as never);
  mockCookies.get.mockReturnValue({ value: adminSessionToken(role) });
}

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/library/kbs/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listKnowledgeBases).mockResolvedValue([
    { knowledge_base_id: "kb1", knowledge_base_name: "KB 1" },
  ] as never);
  vi.mocked(prisma.locationKnowledgeBase.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.locationKnowledgeBase.createMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.location.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  vi.mocked(checkLimitForLocation).mockResolvedValue({ status: "allow" } as never);
});

describe("POST /api/admin/library/kbs/assign", () => {
  it("returns 401 without session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await POST(makeRequest({ locationId: "loc1", retellIds: ["kb1"] }), context);
    expect(res.status).toBe(401);
  });

  it("assigns KBs", async () => {
    signedInAs("owner");
    const res = await POST(makeRequest({ locationId: "loc1", retellIds: ["kb1"] }), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.assigned).toBe(1);
  });

  it("returns 403 LIMIT_REACHED", async () => {
    signedInAs("owner");
    vi.mocked(checkLimitForLocation).mockResolvedValue({ status: "block", message: "KB limit" } as never);
    const res = await POST(makeRequest({ locationId: "loc1", retellIds: ["kb1"] }), context);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("LIMIT_REACHED");
  });
});
