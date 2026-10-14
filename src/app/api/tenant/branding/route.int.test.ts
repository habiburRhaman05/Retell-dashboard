import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { tenantSessionToken, liveTenant } from "@/test/auth";
import { GET } from "./route";

const findTenant = vi.mocked(prisma.tenant.findUnique);
const context = { params: Promise.resolve({}) };

function request() {
  return new NextRequest("http://localhost/api/tenant/branding");
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/tenant/branding", () => {
  it("returns 401 without a tenant session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const res = await GET(request(), context);
    expect(res.status).toBe(401);
  });

  it("returns this tenant's brand colors", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSessionToken() });
    findTenant.mockResolvedValue({
      ...liveTenant(),
      id: "t1",
      brandPrimaryColor: "#1d6bf3",
      brandSecondaryColor: "#1558d6",
    } as never);

    const res = await GET(request(), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ brandPrimaryColor: "#1d6bf3", brandSecondaryColor: "#1558d6" });
  });

  it("returns nulls when the tenant has no custom branding", async () => {
    mockCookies.get.mockReturnValue({ value: tenantSessionToken() });
    findTenant.mockResolvedValue({
      ...liveTenant(),
      id: "t1",
      brandPrimaryColor: null,
      brandSecondaryColor: null,
    } as never);

    const res = await GET(request(), context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ brandPrimaryColor: null, brandSecondaryColor: null });
  });
});
