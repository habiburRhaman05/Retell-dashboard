import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
  },
}));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => jar),
}));

import { prisma } from "@/lib/prisma";
import { createTenantLinkToken } from "@/modules/auth/tokens";
import { signTestToken, tenantSessionToken } from "@/test/auth";
import { POST } from "./route";

const findTenant = vi.mocked(prisma.tenant.findUnique);

const activeTenant = (over: Record<string, unknown> = {}) =>
  ({ id: "t1", crmLocationId: "loc_1", name: "Acme", status: "active", ...over }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  jar.get.mockReturnValue(undefined);
});

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
    expect((await res.json()).error).toMatch(/Location ID/i);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(new NextRequest("http://localhost/api/auth/tenant", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });

  describe("without a signed link", () => {
    it("does NOT sign anyone in just because they know a registered location id", async () => {
      findTenant.mockResolvedValue(activeTenant());

      const res = await POST(makeRequest({ locationId: "loc_1" }));

      expect(res.status).toBe(401);
      expect((await res.json()).code).toBe("LINK_REQUIRED");
      expect(jar.set).not.toHaveBeenCalled();
      expect(findTenant).not.toHaveBeenCalled();
    });

    it("accepts an existing session for the same location without issuing a new cookie", async () => {
      jar.get.mockReturnValue({ value: tenantSessionToken() });
      findTenant.mockResolvedValue(activeTenant());

      const res = await POST(makeRequest({ locationId: "loc_1" }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, tenantName: "Acme" });
      expect(jar.set).not.toHaveBeenCalled();
    });

    it("rejects an existing session when the URL names a different location", async () => {
      jar.get.mockReturnValue({ value: tenantSessionToken() });

      const res = await POST(makeRequest({ locationId: "loc_other" }));

      expect(res.status).toBe(401);
      expect((await res.json()).code).toBe("LINK_REQUIRED");
    });

    it("rejects a forged session cookie", async () => {
      jar.get.mockReturnValue({
        value: Buffer.from(JSON.stringify({ tenantId: "t1", crmLocationId: "loc_1" })).toString("base64"),
      });
      const res = await POST(makeRequest({ locationId: "loc_1" }));
      expect(res.status).toBe(401);
    });

    it("locks out a suspended tenant even though their cookie is still valid", async () => {
      jar.get.mockReturnValue({ value: tenantSessionToken() });
      findTenant.mockResolvedValue(activeTenant({ status: "suspended" }));

      const res = await POST(makeRequest({ locationId: "loc_1" }));

      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("ACCOUNT_SUSPENDED");
    });
  });

  describe("with a signed link", () => {
    it("signs the tenant in and sets a signed session cookie", async () => {
      findTenant.mockResolvedValue(activeTenant());
      const token = await createTenantLinkToken("loc_1");

      const res = await POST(makeRequest({ locationId: "loc_1", token }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, tenantName: "Acme" });
      const [name, value] = jar.set.mock.calls[0];
      expect(name).toBe("tenant_session");
      expect(value.split(".")).toHaveLength(3);
    });

    it("rejects a link minted for a different location (cannot be reused on another tenant's URL)", async () => {
      const token = await createTenantLinkToken("loc_1");

      const res = await POST(makeRequest({ locationId: "loc_victim", token }));

      expect(res.status).toBe(401);
      expect((await res.json()).code).toBe("INVALID_LINK");
      expect(jar.set).not.toHaveBeenCalled();
    });

    it("rejects a tampered, expired or wrong-kind link", async () => {
      const expired = signTestToken("tenant-link", { loc: "loc_1" }, { nowSec: Math.floor(Date.now() / 1000) - 7200, ttlSec: 60 });
      const wrongKind = signTestToken("tenant-session", { loc: "loc_1" });
      const forged = signTestToken("tenant-link", { loc: "loc_1" }, { secret: "z".repeat(40) });

      for (const token of ["garbage", expired, wrongKind, forged]) {
        const res = await POST(makeRequest({ locationId: "loc_1", token }));
        expect(res.status).toBe(401);
        expect((await res.json()).code).toBe("INVALID_LINK");
      }
      expect(jar.set).not.toHaveBeenCalled();
    });

    it("returns 403 NOT_REGISTERED when the location is not in the database", async () => {
      findTenant.mockResolvedValue(null);
      const token = await createTenantLinkToken("unknown_loc");

      const res = await POST(makeRequest({ locationId: "unknown_loc", token }));

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("NOT_REGISTERED");
      expect(data.error).toMatch(/not registered/i);
    });

    it("returns 403 ACCOUNT_SUSPENDED and sets no cookie for a suspended tenant", async () => {
      findTenant.mockResolvedValue(activeTenant({ status: "suspended", name: "Suspended Co" }));
      const token = await createTenantLinkToken("loc_1");

      const res = await POST(makeRequest({ locationId: "loc_1", token }));

      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("ACCOUNT_SUSPENDED");
      expect(jar.set).not.toHaveBeenCalled();
    });
  });
});
