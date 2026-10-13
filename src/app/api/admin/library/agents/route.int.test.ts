import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
    locationAgent: { findMany: vi.fn() },
    privateRetellItem: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({
  listAllAgents: vi.fn(),
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
  headers: vi.fn(() => new Map()),
}));

import { prisma } from "@/lib/prisma";
import { listAllAgents } from "@/lib/retell-api";
import { adminSessionToken, liveAdmin } from "@/test/auth";
import { GET } from "./route";

function signedInAs(role: "owner" | "support") {
  vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(liveAdmin(role) as never);
  mockCookies.get.mockReturnValue({ value: adminSessionToken(role) });
}

const request = () => new NextRequest("http://localhost/api/admin/library/agents");
const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAllAgents).mockResolvedValue([
    { agent_id: "a1", agent_name: "Agent 1", channel: "voice", last_modification_timestamp: 1 },
    { agent_id: "a2", agent_name: "Agent 2", channel: "chat", last_modification_timestamp: 2 },
  ]);
  vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([
    { retellAgentId: "a1", locationId: "loc1", agentName: "Agent 1", assignedBy: "admin1", createdAt: new Date() },
  ] as never);
  vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);
});

describe("GET /api/admin/library/agents", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await GET(request(), context);
    expect(res.status).toBe(401);
  });

  it("returns library with assignment statuses", async () => {
    signedInAs("owner");
    const res = await GET(request(), context);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.find((a: { agentId: string }) => a.agentId === "a1").status).toBe("assigned");
    expect(data.find((a: { agentId: string }) => a.agentId === "a2").status).toBe("unassigned");
  });

  it("support role can read the library", async () => {
    signedInAs("support");
    const res = await GET(request(), context);
    expect(res.status).toBe(200);
  });
});
