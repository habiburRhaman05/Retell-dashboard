import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { GET, POST } from "@/app/api/retell/agents/route";

// Storage and upstream are both fake here; the route's own filtering,
// orphan cleanup, naming and conflict rules are what runs for real.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationAgent: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    location: { upsert: vi.fn(), findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
    limitPolicy: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/retell-api")>();
  return {
    ...actual,
    listAllAgents: vi.fn(),
    createAgent: vi.fn(),
  };
});

const findUnique = vi.mocked(prisma.location.findUnique);
const tenantFindUnique = vi.mocked(prisma.tenant.findUnique);
const limitPolicyFindUnique = vi.mocked(prisma.limitPolicy.findUnique);
const agentCount = vi.mocked(prisma.locationAgent.count);
const findMany = vi.mocked(prisma.locationAgent.findMany);
const deleteMany = vi.mocked(prisma.locationAgent.deleteMany);
const createMapping = vi.mocked(prisma.locationAgent.create);
const upsertLocation = vi.mocked(prisma.location.upsert);
const listAllAgents = vi.mocked(retell.listAllAgents);
const createAgent = vi.mocked(retell.createAgent);

const voice = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  agent_id: id,
  agent_name: name,
  channel: "voice",
  version: 1,
  ...extra,
});

function listRequest(query = "locationId=loc_1") {
  return new NextRequest(`http://localhost/api/retell/agents?${query}`);
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/retell/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertLocation.mockResolvedValue({} as never);
  createMapping.mockResolvedValue({} as never);
  // no tenant owns this location in tests, so no limit policy applies
  tenantFindUnique.mockResolvedValue(null as never);
  // every test location is called "Bright AI", so names get that suffix
  findUnique.mockResolvedValue({ name: "Bright AI" } as never);
});

describe("GET /api/retell/agents", () => {
  it("requires a locationId", async () => {
    const res = await GET(listRequest(""));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "locationId is required" });
    expect(listAllAgents).not.toHaveBeenCalled();
  });

  it("returns [] without calling Retell when the location has no mappings", async () => {
    findMany.mockResolvedValue([] as never);

    const res = await GET(listRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(listAllAgents).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("returns only this location's agents, hiding test-chat agents", async () => {
    findMany.mockResolvedValue([
      { retellAgentId: "a1" },
      { retellAgentId: "a2" },
    ] as never);
    listAllAgents.mockResolvedValue([
      voice("a1", "Reception"),
      voice("a2", "Plumbing"),
      voice("a3", "Other location"),
      voice("a2", "Plumbing [test-chat:agent_a2]", { channel: "chat" }),
    ] as never);

    const res = await GET(listRequest());
    const body = await res.json();

    expect(body.map((a: { agent_id: string }) => a.agent_id)).toEqual(["a1", "a2"]);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("deletes mappings whose agent no longer exists upstream", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "gone" }, { retellAgentId: "kept" }] as never);
    listAllAgents.mockResolvedValue([voice("kept", "Still here")] as never);
    deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await GET(listRequest());
    const body = await res.json();

    expect(body.map((a: { agent_id: string }) => a.agent_id)).toEqual(["kept"]);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { locationId: "loc_1", retellAgentId: { in: ["gone"] } },
    });
  });

  it("returns 500 with Retell's message when the upstream call fails", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    listAllAgents.mockRejectedValue(new Error("Retell is down"));

    const res = await GET(listRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Retell is down" });
    // never clean up mappings when the upstream list failed: that would
    // wrongly orphan every agent in the location
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/retell/agents", () => {
  it("requires a locationId", async () => {
    const res = await POST(postRequest({ agent_name: "X" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "locationId is required" });
    expect(createAgent).not.toHaveBeenCalled();
  });

  it("suffixes the location name, tags the agent and records the mapping", async () => {
    findMany.mockResolvedValue([] as never); // name not taken
    createAgent.mockResolvedValue({ agent_id: "a_new", agent_name: "Reception - Bright AI" } as never);

    const res = await POST(
      postRequest({
        locationId: "loc_1",
        agent_name: "Reception",
        voice_id: "voice_1",
        assigned_tags: ["custom-tag"],
      })
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ agent_id: "a_new", agent_name: "Reception - Bright AI" });

    const payload = createAgent.mock.calls[0][0] as {
      agent_name: string;
      assigned_tags: string[];
      locationId?: string;
    };
    expect(payload.agent_name).toBe("Reception - Bright AI");
    expect(payload.assigned_tags).toEqual(["loc:loc_1", "custom-tag"]);
    expect(payload.locationId).toBeUndefined();

    expect(upsertLocation).toHaveBeenCalledWith({
      where: { locationId: "loc_1" },
      create: { locationId: "loc_1" },
      update: {},
    });
    expect(createMapping).toHaveBeenCalledWith({
      data: { locationId: "loc_1", retellAgentId: "a_new", agentName: "Reception - Bright AI" },
    });
  });

  it("rejects a duplicate name in the same location with 409", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    listAllAgents.mockResolvedValue([voice("a1", "Reception - Bright AI")] as never);

    const res = await POST(
      postRequest({ locationId: "loc_1", agent_name: "reception", voice_id: "v1" })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/);
    expect(createAgent).not.toHaveBeenCalled();
  });

  it("treats a name already used in the location as taken, whoever owns it", async () => {
    // POST is create-only: unlike renames it passes no exclusion id, so even
    // an agent_id in the payload cannot claim an existing name.
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    listAllAgents.mockResolvedValue([voice("a1", "Reception - Bright AI")] as never);

    const res = await POST(
      postRequest({
        locationId: "loc_1",
        agent_name: "Reception",
        voice_id: "v1",
        agent_id: "a1",
      })
    );

    expect(res.status).toBe(409);
    expect(createAgent).not.toHaveBeenCalled();
  });

  it("forwards unnamed agents without a location suffix", async () => {
    findMany.mockResolvedValue([] as never);
    createAgent.mockResolvedValue({ agent_id: "a_new" } as never);

    const res = await POST(postRequest({ locationId: "loc_1", agent_name: "   ", voice_id: "v1" }));

    expect(res.status).toBe(201);
    expect(createAgent.mock.calls[0][0]).toMatchObject({ agent_name: "   " });
    expect(findMany).not.toHaveBeenCalled(); // no name, no duplicate check
  });

  it("returns 500 when Retell rejects the create", async () => {
    findMany.mockResolvedValue([] as never);
    createAgent.mockRejectedValue(new Error("voice_id is invalid"));

    const res = await POST(postRequest({ locationId: "loc_1", agent_name: "X", voice_id: "bad" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "voice_id is invalid" });
    expect(createMapping).not.toHaveBeenCalled();
  });

  it("returns 403 when the tenant is at its agent limit", async () => {
    tenantFindUnique.mockResolvedValue({ id: "t1", crmLocationId: "loc_1" } as never);
    limitPolicyFindUnique.mockResolvedValue({
      tenantId: "t1",
      metric: "AGENTS",
      limitValue: 2,
      period: "monthly",
      warnAtPct: 80,
      mode: "hard",
    } as never);
    agentCount.mockResolvedValue(2 as never); // 2 of 2 used

    const res = await POST(
      postRequest({ locationId: "loc_1", agent_name: "Third", voice_id: "v1" })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("LIMIT_REACHED");
    expect(body.error).toMatch(/2\/2/);
    expect(createAgent).not.toHaveBeenCalled();
    expect(createMapping).not.toHaveBeenCalled();
  });

  it("allows the create when under the agent limit", async () => {
    tenantFindUnique.mockResolvedValue({ id: "t1", crmLocationId: "loc_1" } as never);
    limitPolicyFindUnique.mockResolvedValue({
      tenantId: "t1",
      metric: "AGENTS",
      limitValue: 5,
      period: "monthly",
      warnAtPct: 80,
      mode: "hard",
    } as never);
    agentCount.mockResolvedValue(1 as never);
    findMany.mockResolvedValue([] as never);
    createAgent.mockResolvedValue({ agent_id: "a_new", agent_name: "Third - Bright AI" } as never);

    const res = await POST(
      postRequest({ locationId: "loc_1", agent_name: "Third", voice_id: "v1" })
    );

    expect(res.status).toBe(201);
    expect(createAgent).toHaveBeenCalled();
  });
});
