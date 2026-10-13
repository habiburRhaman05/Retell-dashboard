import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationAgent: { findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({
  getAnyAgent: vi.fn(),
  updateAnyAgent: vi.fn(),
  deleteAnyAgent: vi.fn(),
  deleteTestChatAgents: vi.fn(),
}));

vi.mock("@/lib/agent-name-check", () => ({ nameTakenInLocation: vi.fn() }));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(() => jar) }));

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { nameTakenInLocation } from "@/lib/agent-name-check";
import { tenantSessionToken, liveTenant } from "@/test/auth";
import { GET, PATCH, DELETE } from "./route";

const findMapping = vi.mocked(prisma.locationAgent.findUnique);
const updateMapping = vi.mocked(prisma.locationAgent.updateMany);
const deleteMapping = vi.mocked(prisma.locationAgent.deleteMany);
const getAnyAgent = vi.mocked(retell.getAnyAgent);
const updateAnyAgent = vi.mocked(retell.updateAnyAgent);
const deleteAnyAgent = vi.mocked(retell.deleteAnyAgent);
const deleteTestChatAgents = vi.mocked(retell.deleteTestChatAgents);
const nameTaken = vi.mocked(nameTakenInLocation);

const ctx = { params: Promise.resolve({ agentId: "agent_1" }) };
const base = "http://localhost/api/retell/agents/agent_1";
const get = (query = "locationId=loc_1") => new NextRequest(`${base}?${query}`);
const del = (query = "locationId=loc_1") => new NextRequest(`${base}?${query}`, { method: "DELETE" });
const patch = (body: unknown) =>
  new NextRequest(base, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  jar.get.mockReturnValue({ value: tenantSessionToken() });
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
  findMapping.mockResolvedValue({ id: "m1" } as never);
  nameTaken.mockResolvedValue(false);
  getAnyAgent.mockResolvedValue({ agent_id: "agent_1", agent_name: "Reception" } as never);
  updateAnyAgent.mockResolvedValue({ agent_id: "agent_1", agent_name: "Front Desk" } as never);
  deleteAnyAgent.mockResolvedValue(undefined);
  deleteTestChatAgents.mockResolvedValue(undefined);
});

describe("access control (all methods)", () => {
  it("returns 401 without a session and touches nothing", async () => {
    jar.get.mockReturnValue(undefined);
    expect((await GET(get(), ctx)).status).toBe(401);
    expect((await PATCH(patch({ locationId: "loc_1", agent_name: "x" }), ctx)).status).toBe(401);
    expect((await DELETE(del(), ctx)).status).toBe(401);
    expect(getAnyAgent).not.toHaveBeenCalled();
    expect(updateAnyAgent).not.toHaveBeenCalled();
    expect(deleteAnyAgent).not.toHaveBeenCalled();
  });

  it("returns 403 for another tenant's location on every method, touching nothing", async () => {
    expect((await GET(get("locationId=loc_victim"), ctx)).status).toBe(403);
    expect((await PATCH(patch({ locationId: "loc_victim", agent_name: "x" }), ctx)).status).toBe(403);
    expect((await DELETE(del("locationId=loc_victim"), ctx)).status).toBe(403);
    expect(findMapping).not.toHaveBeenCalled();
    expect(deleteAnyAgent).not.toHaveBeenCalled();
  });

  it("returns 403 and never calls Retell when the agent is not mapped to the tenant's location", async () => {
    findMapping.mockResolvedValue(null);
    expect((await GET(get(), ctx)).status).toBe(403);
    expect((await PATCH(patch({ locationId: "loc_1", agent_name: "x" }), ctx)).status).toBe(403);
    expect((await DELETE(del(), ctx)).status).toBe(403);
    expect(getAnyAgent).not.toHaveBeenCalled();
    expect(updateAnyAgent).not.toHaveBeenCalled();
    expect(deleteAnyAgent).not.toHaveBeenCalled();
    expect(deleteMapping).not.toHaveBeenCalled();
  });

  it("returns 403 ACCOUNT_SUSPENDED for a suspended tenant", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant({ status: "suspended" }) as never);
    const res = await DELETE(del(), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ACCOUNT_SUSPENDED");
    expect(deleteAnyAgent).not.toHaveBeenCalled();
  });

  it("requires a locationId", async () => {
    expect((await GET(get(""), ctx)).status).toBe(400);
    expect((await PATCH(patch({ agent_name: "x" }), ctx)).status).toBe(400);
    expect((await DELETE(del(""), ctx)).status).toBe(400);
  });
});

describe("GET /api/retell/agents/[agentId]", () => {
  it("returns the agent", async () => {
    const res = await GET(get(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ agent_id: "agent_1" });
  });

  it("returns 500 with Retell's message on failure", async () => {
    getAnyAgent.mockRejectedValue(new Error("Retell is down"));
    const res = await GET(get(), ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Retell is down" });
  });
});

describe("PATCH /api/retell/agents/[agentId]", () => {
  it("updates the agent without forwarding locationId to Retell, and syncs the saved name", async () => {
    const res = await PATCH(patch({ locationId: "loc_1", agent_name: "  Front Desk  ", voice_id: "v1" }), ctx);

    expect(res.status).toBe(200);
    expect(updateAnyAgent).toHaveBeenCalledWith("agent_1", { agent_name: "Front Desk", voice_id: "v1" });
    expect(updateMapping).toHaveBeenCalledWith({
      where: { locationId: "loc_1", retellAgentId: "agent_1" },
      data: { agentName: "Front Desk" },
    });
  });

  it("rejects an empty name", async () => {
    const res = await PATCH(patch({ locationId: "loc_1", agent_name: "   " }), ctx);
    expect(res.status).toBe(400);
    expect(updateAnyAgent).not.toHaveBeenCalled();
  });

  it("rejects a name another agent in the location already has", async () => {
    nameTaken.mockResolvedValue(true);
    const res = await PATCH(patch({ locationId: "loc_1", agent_name: "Taken" }), ctx);
    expect(res.status).toBe(409);
    expect(updateAnyAgent).not.toHaveBeenCalled();
  });

  it("returns 500 with Retell's message on failure", async () => {
    updateAnyAgent.mockRejectedValue(new Error("bad field"));
    const res = await PATCH(patch({ locationId: "loc_1", voice_id: "v1" }), ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "bad field" });
  });
});

describe("DELETE /api/retell/agents/[agentId]", () => {
  it("deletes only the tenant's own agent, its hidden test chat, and the mapping", async () => {
    const res = await DELETE(del(), ctx);

    expect(res.status).toBe(204);
    expect(deleteAnyAgent).toHaveBeenCalledWith("agent_1");
    expect(deleteTestChatAgents).toHaveBeenCalledWith("agent_1");
    expect(deleteMapping).toHaveBeenCalledWith({ where: { locationId: "loc_1", retellAgentId: "agent_1" } });
  });

  it("still deletes when cleaning up the hidden test chat fails", async () => {
    deleteTestChatAgents.mockRejectedValue(new Error("busy"));
    const res = await DELETE(del(), ctx);
    expect(res.status).toBe(204);
    expect(deleteMapping).toHaveBeenCalled();
  });

  it("keeps the mapping when Retell refuses the delete", async () => {
    deleteAnyAgent.mockRejectedValue(new Error("nope"));
    const res = await DELETE(del(), ctx);
    expect(res.status).toBe(500);
    expect(deleteMapping).not.toHaveBeenCalled();
  });
});
