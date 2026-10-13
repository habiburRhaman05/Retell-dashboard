import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { locationAgent: { findMany: vi.fn() }, tenant: { findUnique: vi.fn() } },
}));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(() => jar) }));

vi.mock("@/lib/retell-api", () => ({
  listAllAgents: vi.fn(),
  hydrateAgents: vi.fn(),
  getRetellLlm: vi.fn(),
  listCalls: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { tenantSessionToken, liveTenant } from "@/test/auth";
import { GET } from "./route";

const ctx = { params: Promise.resolve({}) };

const findMany = vi.mocked(prisma.locationAgent.findMany);
const listAllAgents = vi.mocked(retell.listAllAgents);
const hydrateAgents = vi.mocked(retell.hydrateAgents);
const getRetellLlm = vi.mocked(retell.getRetellLlm);
const listCalls = vi.mocked(retell.listCalls);

const summary = (id: string, channel: "voice" | "chat" = "voice") => ({
  agent_id: id,
  agent_name: id,
  channel,
  last_modification_timestamp: 1,
});

const request = (query = "locationId=loc_1") =>
  new NextRequest(`http://localhost/api/retell/analytics?${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  jar.get.mockReturnValue({ value: tenantSessionToken() });
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
  findMany.mockResolvedValue([{ retellAgentId: "a1" }, { retellAgentId: "c1" }] as never);
  listCalls.mockResolvedValue({ items: [], has_more: false } as never);
  hydrateAgents.mockImplementation(async (list) => list as never);
});

describe("GET /api/retell/analytics", () => {
  it("requires a locationId", async () => {
    const res = await GET(request(""), ctx);
    expect(res.status).toBe(400);
    expect(listAllAgents).not.toHaveBeenCalled();
  });

  it("rejects an invalid date range", async () => {
    const res = await GET(request("locationId=loc_1&start=200&end=100"), ctx);
    expect(res.status).toBe(400);
    expect(listCalls).not.toHaveBeenCalled();
  });

  it("returns empty analytics without calling Retell when the location has no agents", async () => {
    findMany.mockResolvedValue([] as never);

    const res = await GET(request(), ctx);

    expect(res.status).toBe(200);
    expect((await res.json()).callAnalytics.totalCalls).toBe(0);
    expect(listAllAgents).not.toHaveBeenCalled();
    expect(hydrateAgents).not.toHaveBeenCalled();
    expect(listCalls).not.toHaveBeenCalled();
  });

  it("loads settings only for this location's voice agents", async () => {
    listAllAgents.mockResolvedValue([
      summary("a1"),
      summary("c1", "chat"),
      summary("other_location"),
    ] as never);

    const res = await GET(request(), ctx);

    expect(res.status).toBe(200);
    expect(hydrateAgents).toHaveBeenCalledTimes(1);
    const passed = hydrateAgents.mock.calls[0][0] as { agent_id: string }[];
    expect(passed.map((a) => a.agent_id)).toEqual(["a1"]);
  });

  it("looks up each distinct LLM once to name the model", async () => {
    listAllAgents.mockResolvedValue([summary("a1")] as never);
    hydrateAgents.mockResolvedValue([
      { agent_id: "a1", agent_name: "A1", voice_id: "v", response_engine: { type: "retell-llm", llm_id: "llm_1" } },
    ] as never);
    getRetellLlm.mockResolvedValue({ model: "gpt-4o-mini" } as never);

    const res = await GET(request(), ctx);

    expect(res.status).toBe(200);
    expect(getRetellLlm).toHaveBeenCalledTimes(1);
    expect(getRetellLlm).toHaveBeenCalledWith("llm_1");
  });

  it("still returns call analytics when agent details cannot be loaded", async () => {
    listAllAgents.mockResolvedValue([summary("a1")] as never);
    hydrateAgents.mockRejectedValue(new Error("Retell is busy"));

    const res = await GET(request(), ctx);

    expect(res.status).toBe(200);
    expect(listCalls).toHaveBeenCalledTimes(1);
  });

  it("returns 500 with the message when the call list fails", async () => {
    listAllAgents.mockResolvedValue([summary("a1")] as never);
    listCalls.mockRejectedValue(new Error("calls broke"));

    const res = await GET(request(), ctx);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "calls broke" });
  });
});

describe("access control", () => {
  it("returns 401 without a session and never reaches Retell", async () => {
    jar.get.mockReturnValue(undefined);
    const res = await GET(request("locationId=loc_1"), ctx);
    expect(res.status).toBe(401);
    expect(listAllAgents).not.toHaveBeenCalled();
  });

  it("returns 403 when asking for another tenant's location", async () => {
    const res = await GET(request("locationId=loc_victim"), ctx);
    expect(res.status).toBe(403);
    expect(listAllAgents).not.toHaveBeenCalled();
  });

  it("returns 403 ACCOUNT_SUSPENDED for a tenant suspended after signing in", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant({ status: "suspended" }) as never);
    const res = await GET(request(), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ACCOUNT_SUSPENDED");
    expect(listAllAgents).not.toHaveBeenCalled();
  });
});
