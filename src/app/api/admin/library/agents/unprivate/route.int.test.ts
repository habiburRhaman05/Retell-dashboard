import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    privateRetellItem: { deleteMany: vi.fn() },
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
  new NextRequest("http://localhost/api/admin/library/agents/unprivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.privateRetellItem.deleteMany).mockResolvedValue({ count: 2 } as never);
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
});

describe("POST /api/admin/library/agents/unprivate", () => {
  it("returns 401 without session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await POST(makeRequest({ retellIds: ["a1"] }), context);
    expect(res.status).toBe(401);
  });

  it("makes agents public", async () => {
    signedInAs("owner");
    const res = await POST(makeRequest({ retellIds: ["a1", "a2"] }), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unmarked).toBe(2);
  });
});
