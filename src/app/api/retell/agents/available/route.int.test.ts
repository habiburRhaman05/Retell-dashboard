import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { locationAgent: { findMany: vi.fn() }, tenant: { findUnique: vi.fn() } },
}));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(() => jar) }));

vi.mock("@/lib/retell-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/retell-api")>();
  return { ...actual, listAllAgents: vi.fn(), hydrateAgents: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { tenantSessionToken, liveTenant } from "@/test/auth";
import { GET } from "./route";

const ctx = { params: Promise.resolve({}) };

const findMany = vi.mocked(prisma.locationAgent.findMany);
const listAllAgents = vi.mocked(retell.listAllAgents);
const hydrateAgents = vi.mocked(retell.hydrateAgents);

const summary = (id: string, name: string, channel: "voice" | "chat" = "voice") => ({
  agent_id: id,
  agent_name: name,
  channel,
  last_modification_timestamp: 1,
});

const request = (query = "locationId=loc_1") =>
  new NextRequest(`http://localhost/api/retell/agents/available?${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  jar.get.mockReturnValue({ value: tenantSessionToken() });
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
});

describe("GET /api/retell/agents/available", () => {
  it("requires a locationId", async () => {
    const res = await GET(request(""), ctx);
    expect(res.status).toBe(400);
    expect(listAllAgents).not.toHaveBeenCalled();
  });

  it("lists agents no location has claimed yet, hiding test-chat agents", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "taken" }] as never);
    listAllAgents.mockResolvedValue([
      summary("taken", "Already assigned"),
      summary("free1", "Free one"),
      summary("free2", "Free chat", "chat"),
      summary("hidden", "Plumbing [test-chat:agent_abc123]", "chat"),
    ] as never);

    const res = await GET(request(), ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.map((a: { agent_id: string }) => a.agent_id)).toEqual(["free1", "free2"]);
  });

  it("does not fetch per-agent details for the whole account", async () => {
    findMany.mockResolvedValue([] as never);
    listAllAgents.mockResolvedValue([summary("free1", "Free one")] as never);

    await GET(request(), ctx);

    expect(hydrateAgents).not.toHaveBeenCalled();
  });

  it("returns 500 with Retell's message when the upstream list fails", async () => {
    findMany.mockResolvedValue([] as never);
    listAllAgents.mockRejectedValue(new Error("Retell is down"));

    const res = await GET(request(), ctx);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Retell is down" });
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
