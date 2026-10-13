import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationAgent: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({ createWebCall: vi.fn() }));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(() => jar) }));

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { tenantSessionToken, liveTenant } from "@/test/auth";
import { POST } from "./route";

const findMapping = vi.mocked(prisma.locationAgent.findUnique);
const createWebCall = vi.mocked(retell.createWebCall);

const ctx = { params: Promise.resolve({ agentId: "agent_1" }) };
const post = (body: unknown) =>
  new NextRequest("http://localhost/api/retell/agents/agent_1/web-call", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  jar.get.mockReturnValue({ value: tenantSessionToken() });
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
  findMapping.mockResolvedValue({ id: "m1" } as never);
  createWebCall.mockResolvedValue({ call_id: "call_1", access_token: "tok" } as never);
});

describe("POST /api/retell/agents/[agentId]/web-call", () => {
  it("returns 401 without a session and starts no call", async () => {
    jar.get.mockReturnValue(undefined);
    const res = await POST(post({ locationId: "loc_1" }), ctx);
    expect(res.status).toBe(401);
    expect(createWebCall).not.toHaveBeenCalled();
  });

  it("returns 403 for a suspended tenant and starts no call", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant({ status: "suspended" }) as never);
    const res = await POST(post({ locationId: "loc_1" }), ctx);
    expect(res.status).toBe(403);
    expect(createWebCall).not.toHaveBeenCalled();
  });

  it("requires a locationId", async () => {
    const res = await POST(post({}), ctx);
    expect(res.status).toBe(400);
    expect(createWebCall).not.toHaveBeenCalled();
  });

  it("returns 403 when the body names another tenant's location", async () => {
    const res = await POST(post({ locationId: "loc_victim" }), ctx);
    expect(res.status).toBe(403);
    expect(findMapping).not.toHaveBeenCalled();
    expect(createWebCall).not.toHaveBeenCalled();
  });

  it("returns 403 and starts no call when the agent is not this location's", async () => {
    findMapping.mockResolvedValue(null);
    const res = await POST(post({ locationId: "loc_1" }), ctx);
    expect(res.status).toBe(403);
    expect(createWebCall).not.toHaveBeenCalled();
  });

  it("starts a test call for the tenant's own agent", async () => {
    const res = await POST(post({ locationId: "loc_1" }), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ call_id: "call_1" });
    expect(createWebCall).toHaveBeenCalledWith("agent_1");
    expect(findMapping).toHaveBeenCalledWith({
      where: { locationId_retellAgentId: { locationId: "loc_1", retellAgentId: "agent_1" } },
    });
  });

  it("returns 500 with Retell's message when the call cannot start", async () => {
    createWebCall.mockRejectedValue(new Error("no minutes"));
    const res = await POST(post({ locationId: "loc_1" }), ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "no minutes" });
  });
});
