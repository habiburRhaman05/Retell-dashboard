import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    locationAgent: { deleteMany: vi.fn() },
    locationKnowledgeBase: { deleteMany: vi.fn() },
    privateRetellItem: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
  headers: vi.fn(() => new Map()),
}));

import { prisma } from "@/lib/prisma";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { POST } from "./route";

function signedInAs(role: "owner" | "support") {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin(role) as never);
  mockCookies.get.mockReturnValue({ value: adminSessionToken(role) });
}

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/library/kbs/private", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.locationKnowledgeBase.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.privateRetellItem.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
});

describe("POST /api/admin/library/kbs/private", () => {
  it("returns 401 without session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await POST(makeRequest({ retellIds: ["kb1"] }), context);
    expect(res.status).toBe(401);
  });

  it("marks KBs as private", async () => {
    signedInAs("owner");
    const res = await POST(makeRequest({ retellIds: ["kb1"] }), context);
    expect(res.status).toBe(200);
    expect((await res.json()).marked).toBe(1);
  });
});
