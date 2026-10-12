import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const findTenant = vi.mocked(prisma.tenant.findUnique);

beforeEach(() => vi.clearAllMocks());

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/tenant", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/tenant", () => {
  it("returns 400 when locationId is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Location ID/i);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/auth/tenant", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 NOT_REGISTERED when location not in DB", async () => {
    findTenant.mockResolvedValue(null);
    const res = await POST(makeRequest({ locationId: "unknown_loc" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("NOT_REGISTERED");
    expect(data.error).toMatch(/not registered/i);
  });

  it("returns 403 ACCOUNT_SUSPENDED when tenant is suspended", async () => {
    findTenant.mockResolvedValue({
      id: "t1",
      crmLocationId: "loc_1",
      name: "Suspended Co",
      status: "suspended",
    } as never);
    const res = await POST(makeRequest({ locationId: "loc_1" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("returns 200 and sets session for active tenant", async () => {
    findTenant.mockResolvedValue({
      id: "t1",
      crmLocationId: "loc_active",
      name: "Active Corp",
      status: "active",
    } as never);
    const res = await POST(makeRequest({ locationId: "loc_active" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.tenantName).toBe("Active Corp");
  });
});
