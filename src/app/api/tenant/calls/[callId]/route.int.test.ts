import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    locationAgent: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({
  getCall: vi.fn(),
  fetchPublicLog: vi.fn(),
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { tenantSessionToken, liveTenant } from "@/test/auth";
import { GET } from "./route";

const findAgents = vi.mocked(prisma.locationAgent.findMany);
const getCall = vi.mocked(retell.getCall);

function tenantSession() {
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
  return tenantSessionToken();
}

const context = { params: Promise.resolve({ callId: "call_1" }) };

function request() {
  return new NextRequest("http://localhost/api/tenant/calls/call_1");
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/tenant/calls/[callId]", () => {
  it("returns 401 without a tenant session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await GET(request(), context);
    expect(res.status).toBe(401);
  });

  it("returns 403 when the call belongs to another tenant's agent", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    findAgents.mockResolvedValue([{ retellAgentId: "a1" } as never]);
    getCall.mockResolvedValue({ call_id: "call_1", agent_id: "not_my_agent" } as never);

    const res = await GET(request(), context);
    expect(res.status).toBe(403);
  });

  it("returns 403 (not 404) for a call_id that doesn't exist at all", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    findAgents.mockResolvedValue([{ retellAgentId: "a1" } as never]);
    getCall.mockRejectedValue(new Error("not found"));

    const res = await GET(request(), context);
    expect(res.status).toBe(403);
  });

  it("returns the call detail on the happy path", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    findAgents.mockResolvedValue([{ retellAgentId: "a1" } as never]);
    getCall.mockResolvedValue({
      call_id: "call_1",
      agent_id: "a1",
      transcript: "hello",
    } as never);

    const res = await GET(request(), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.call.call_id).toBe("call_1");
    expect(data.logLines).toEqual([]);
  });
});
