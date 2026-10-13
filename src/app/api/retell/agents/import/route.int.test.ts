import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationAgent: { findMany: vi.fn(), createMany: vi.fn(), count: vi.fn() },
    location: { upsert: vi.fn() },
    tenant: { findUnique: vi.fn() },
    limitPolicy: { findUnique: vi.fn() },
  },
}));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(() => jar) }));

vi.mock("@/lib/retell-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/retell-api")>();
  return { ...actual, listAllAgents: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { POST } from "@/app/api/retell/agents/import/route";
import { tenantSessionToken, liveTenant } from "@/test/auth";

const ctx = { params: Promise.resolve({}) };

const findMany = vi.mocked(prisma.locationAgent.findMany);
const createMany = vi.mocked(prisma.locationAgent.createMany);
const upsertLocation = vi.mocked(prisma.location.upsert);
const agentCount = vi.mocked(prisma.locationAgent.count);
// auth looks the tenant up by id; limits look it up by crmLocationId
let limitTenant: unknown = null;
const mockTenantLookups = () =>
  vi.mocked(prisma.tenant.findUnique).mockImplementation(
    (async (args: { where: { id?: string } }) => (args.where.id ? liveTenant() : limitTenant)) as never
  );
const limitPolicyFindUnique = vi.mocked(prisma.limitPolicy.findUnique);
const listAllAgents = vi.mocked(retell.listAllAgents);

function importRequest(agentIds: string[]) {
  return new NextRequest("http://localhost/api/retell/agents/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locationId: "loc_1", agentIds }),
  });
}

const upstreamAgents = ["a_new1", "a_new2"].map((id) => ({
  agent_id: id,
  agent_name: `Imported ${id}`,
  channel: "voice",
}));

beforeEach(() => {
  vi.clearAllMocks();
  upsertLocation.mockResolvedValue({} as never);
  createMany.mockResolvedValue({ count: 2 } as never);
  findMany.mockResolvedValue([] as never); // nothing mapped yet
  listAllAgents.mockResolvedValue(upstreamAgents as never);
  limitTenant = { id: "t1", crmLocationId: "loc_1" };
  mockTenantLookups();
  jar.get.mockReturnValue({ value: tenantSessionToken() });
});

describe("POST /api/retell/agents/import", () => {
  it("requires locationId and agentIds", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/retell/agents/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId: "loc_1" }),
      })
    , ctx);
    expect(res.status).toBe(400);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("blocks an import that would push the tenant past its agent limit", async () => {
    limitPolicyFindUnique.mockResolvedValue({
      tenantId: "t1",
      metric: "AGENTS",
      limitValue: 2,
      period: "monthly",
      warnAtPct: 80,
      mode: "hard",
    } as never);
    agentCount.mockResolvedValue(1); // 1 used + 2 to import = 3 > 2

    const res = await POST(importRequest(["a_new1", "a_new2"]), ctx);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("LIMIT_REACHED");
    expect(createMany).not.toHaveBeenCalled();
    expect(upsertLocation).not.toHaveBeenCalled();
  });

  it("imports when the tenant is under its agent limit", async () => {
    limitPolicyFindUnique.mockResolvedValue({
      tenantId: "t1",
      metric: "AGENTS",
      limitValue: 10,
      period: "monthly",
      warnAtPct: 80,
      mode: "hard",
    } as never);
    agentCount.mockResolvedValue(1);

    const res = await POST(importRequest(["a_new1", "a_new2"]), ctx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) })
    );
  });

  it("imports for a location no tenant owns (no policy applies)", async () => {
    limitTenant = null;

    const res = await POST(importRequest(["a_new1"]), ctx);

    expect(res.status).toBe(200);
    expect(limitPolicyFindUnique).not.toHaveBeenCalled();
  });
});
