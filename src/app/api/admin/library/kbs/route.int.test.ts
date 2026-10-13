import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    locationKnowledgeBase: { findMany: vi.fn() },
    privateRetellItem: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({
  listKnowledgeBases: vi.fn(),
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
  headers: vi.fn(() => new Map()),
}));

import { prisma } from "@/lib/prisma";
import { listKnowledgeBases } from "@/lib/retell-api";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { GET } from "./route";

function signedInAs(role: "owner" | "support") {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin(role) as never);
  mockCookies.get.mockReturnValue({ value: adminSessionToken(role) });
}

const request = () => new NextRequest("http://localhost/api/admin/library/kbs");
const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listKnowledgeBases).mockResolvedValue([
    { knowledge_base_id: "kb1", knowledge_base_name: "KB 1", status: "complete" },
    { knowledge_base_id: "kb2", knowledge_base_name: "KB 2", status: "complete" },
  ] as never);
  vi.mocked(prisma.locationKnowledgeBase.findMany).mockResolvedValue([
    { retellKnowledgeBaseId: "kb1", locationId: "loc1", knowledgeBaseName: "KB 1", assignedBy: "admin1", createdAt: new Date() },
  ] as never);
  vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);
});

describe("GET /api/admin/library/kbs", () => {
  it("returns 401 without session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await GET(request(), context);
    expect(res.status).toBe(401);
  });

  it("returns KB library with assignment statuses", async () => {
    signedInAs("owner");
    const res = await GET(request(), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.find((k: { knowledgeBaseId: string }) => k.knowledgeBaseId === "kb1").status).toBe("assigned");
    expect(data.find((k: { knowledgeBaseId: string }) => k.knowledgeBaseId === "kb2").status).toBe("unassigned");
  });
});
