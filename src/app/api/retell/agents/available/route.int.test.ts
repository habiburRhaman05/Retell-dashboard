import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { locationAgent: { findMany: vi.fn() } },
}));

vi.mock("@/lib/retell-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/retell-api")>();
  return { ...actual, listAllAgents: vi.fn(), hydrateAgents: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { GET } from "./route";

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

beforeEach(() => vi.clearAllMocks());

describe("GET /api/retell/agents/available", () => {
  it("requires a locationId", async () => {
    const res = await GET(request(""));
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

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.map((a: { agent_id: string }) => a.agent_id)).toEqual(["free1", "free2"]);
  });

  it("does not fetch per-agent details for the whole account", async () => {
    findMany.mockResolvedValue([] as never);
    listAllAgents.mockResolvedValue([summary("free1", "Free one")] as never);

    await GET(request());

    expect(hydrateAgents).not.toHaveBeenCalled();
  });

  it("returns 500 with Retell's message when the upstream list fails", async () => {
    findMany.mockResolvedValue([] as never);
    listAllAgents.mockRejectedValue(new Error("Retell is down"));

    const res = await GET(request());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Retell is down" });
  });
});
