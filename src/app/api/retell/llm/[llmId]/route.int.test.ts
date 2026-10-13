import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationAgent: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({
  getAnyAgent: vi.fn(),
  getRetellLlm: vi.fn(),
  updateRetellLlm: vi.fn(),
}));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(() => jar) }));

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { tenantSessionToken, liveTenant } from "@/test/auth";
import { GET, PATCH } from "./route";

const findMapping = vi.mocked(prisma.locationAgent.findUnique);
const getAnyAgent = vi.mocked(retell.getAnyAgent);
const getRetellLlm = vi.mocked(retell.getRetellLlm);
const updateRetellLlm = vi.mocked(retell.updateRetellLlm);

const ctx = (llmId = "llm_mine") => ({ params: Promise.resolve({ llmId }) });
const url = (llmId = "llm_mine", query = "agentId=agent_1") =>
  `http://localhost/api/retell/llm/${llmId}?${query}`;
const patch = (body: unknown, llmId = "llm_mine", query = "agentId=agent_1") =>
  new NextRequest(url(llmId, query), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  jar.get.mockReturnValue({ value: tenantSessionToken() });
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
  findMapping.mockResolvedValue({ id: "m1" } as never);
  getAnyAgent.mockResolvedValue({ agent_id: "agent_1", response_engine: { type: "retell-llm", llm_id: "llm_mine" } } as never);
  getRetellLlm.mockResolvedValue({ llm_id: "llm_mine", general_prompt: "Hello" } as never);
  updateRetellLlm.mockResolvedValue({ llm_id: "llm_mine", general_prompt: "New" } as never);
});

describe("GET /api/retell/llm/[llmId]", () => {
  it("returns 401 without a session and never reaches Retell", async () => {
    jar.get.mockReturnValue(undefined);
    const res = await GET(new NextRequest(url()), ctx());
    expect(res.status).toBe(401);
    expect(getRetellLlm).not.toHaveBeenCalled();
  });

  it("returns 403 ACCOUNT_SUSPENDED for a suspended tenant", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant({ status: "suspended" }) as never);
    const res = await GET(new NextRequest(url()), ctx());
    expect(res.status).toBe(403);
    expect(getRetellLlm).not.toHaveBeenCalled();
  });

  it("requires the agent the LLM belongs to", async () => {
    const res = await GET(new NextRequest(url("llm_mine", "")), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "agentId is required" });
    expect(getRetellLlm).not.toHaveBeenCalled();
  });

  it("checks the agent against the SIGNED-IN tenant's location, never one the caller supplies", async () => {
    // a caller-supplied locationId for another tenant is refused outright
    const spoof = await GET(new NextRequest(url("llm_mine", "agentId=agent_1&locationId=loc_victim")), ctx());
    expect(spoof.status).toBe(403);

    await GET(new NextRequest(url()), ctx());
    expect(findMapping).toHaveBeenCalledWith({
      where: { locationId_retellAgentId: { locationId: "loc_1", retellAgentId: "agent_1" } },
    });
  });

  it("returns 403 when the agent belongs to another location, without fetching the LLM", async () => {
    findMapping.mockResolvedValue(null);
    const res = await GET(new NextRequest(url("llm_victim", "agentId=agent_victim")), ctx("llm_victim"));
    expect(res.status).toBe(403);
    expect(getRetellLlm).not.toHaveBeenCalled();
  });

  it("returns 403 when the LLM is not that agent's own (cannot read an arbitrary LLM via your own agent)", async () => {
    const res = await GET(new NextRequest(url("llm_victim")), ctx("llm_victim"));
    expect(res.status).toBe(403);
    expect(getRetellLlm).not.toHaveBeenCalled();
  });

  it("returns the LLM for the agent that owns it", async () => {
    const res = await GET(new NextRequest(url()), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ llm_id: "llm_mine" });
    expect(getRetellLlm).toHaveBeenCalledWith("llm_mine");
  });

  it("returns 500 with Retell's message when the lookup fails", async () => {
    getRetellLlm.mockRejectedValue(new Error("Retell is down"));
    const res = await GET(new NextRequest(url()), ctx());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Retell is down" });
  });
});

describe("PATCH /api/retell/llm/[llmId]", () => {
  it("returns 401 without a session and changes nothing", async () => {
    jar.get.mockReturnValue(undefined);
    const res = await PATCH(patch({ general_prompt: "x" }), ctx());
    expect(res.status).toBe(401);
    expect(updateRetellLlm).not.toHaveBeenCalled();
  });

  it("returns 403 and changes nothing for another tenant's agent", async () => {
    findMapping.mockResolvedValue(null);
    const res = await PATCH(patch({ general_prompt: "pwned" }), ctx());
    expect(res.status).toBe(403);
    expect(updateRetellLlm).not.toHaveBeenCalled();
  });

  it("returns 403 and changes nothing when the LLM is not the agent's own", async () => {
    const res = await PATCH(patch({ general_prompt: "pwned" }, "llm_victim"), ctx("llm_victim"));
    expect(res.status).toBe(403);
    expect(updateRetellLlm).not.toHaveBeenCalled();
  });

  it("updates the agent's own LLM", async () => {
    const res = await PATCH(patch({ general_prompt: "New" }), ctx());
    expect(res.status).toBe(200);
    expect(updateRetellLlm).toHaveBeenCalledWith("llm_mine", { general_prompt: "New" });
  });

  it("returns 500 with Retell's message when the update fails", async () => {
    updateRetellLlm.mockRejectedValue(new Error("bad prompt"));
    const res = await PATCH(patch({ general_prompt: "New" }), ctx());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "bad prompt" });
  });
});
