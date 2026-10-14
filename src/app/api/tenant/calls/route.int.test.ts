import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    locationAgent: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/retell-api", () => ({
  listCalls: vi.fn(),
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
const listCalls = vi.mocked(retell.listCalls);

function tenantSession() {
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
  return tenantSessionToken();
}

const context = { params: Promise.resolve({}) };

function request(query = "") {
  return new NextRequest(`http://localhost/api/tenant/calls${query ? `?${query}` : ""}`);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/tenant/calls", () => {
  it("returns 401 without a tenant session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await GET(request(), context);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid query params", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    const res = await GET(request("pageSize=9999"), context);
    expect(res.status).toBe(400);
  });

  it("returns an empty page without calling Retell when the tenant has no agents", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    findAgents.mockResolvedValue([]);
    const res = await GET(request(), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toEqual([]);
    expect(listCalls).not.toHaveBeenCalled();
  });

  it("returns the tenant's calls on the happy path", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    findAgents.mockResolvedValue([{ retellAgentId: "a1" } as never]);
    listCalls.mockResolvedValue({
      items: [{ call_id: "call_1", agent_id: "a1" } as never],
      has_more: false,
      pagination_key: null,
      total: 1,
    });

    const res = await GET(request(), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("never reads locationId from the query string", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSession() });
    findAgents.mockResolvedValue([{ retellAgentId: "a1" } as never]);
    listCalls.mockResolvedValue({ items: [], has_more: false, pagination_key: null, total: 0 });

    await GET(request("locationId=someone_elses_location"), context);

    // Scoping comes from the session's crmLocationId, not the query string.
    expect(findAgents).toHaveBeenCalledWith(
      expect.objectContaining({ where: { locationId: "loc_1" } })
    );
  });
});
