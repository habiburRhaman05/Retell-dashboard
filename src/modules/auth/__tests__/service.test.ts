import { describe, it, expect, vi, beforeEach } from "vitest";
import * as crypto from "crypto";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  verifyTenantAccess,
  verifyAdminLogin,
  verifyAdminByCompanyId,
  createAdminUser,
  generateCompanyId,
} from "../service";

const findTenant = vi.mocked(prisma.tenant.findUnique);
const findAdmin = vi.mocked(prisma.adminUser.findUnique);
const createAdmin = vi.mocked(prisma.adminUser.create);

beforeEach(() => vi.clearAllMocks());

describe("verifyTenantAccess", () => {
  it("returns session for active tenant", async () => {
    findTenant.mockResolvedValue({
      id: "t1",
      crmLocationId: "loc_123",
      name: "Acme Corp",
      status: "active",
    } as never);

    const session = await verifyTenantAccess("loc_123");
    expect(session).toEqual({
      tenantId: "t1",
      crmLocationId: "loc_123",
      tenantName: "Acme Corp",
      status: "active",
    });
  });

  it("returns session with suspended status", async () => {
    findTenant.mockResolvedValue({
      id: "t2",
      crmLocationId: "loc_456",
      name: "Suspended Co",
      status: "suspended",
    } as never);

    const session = await verifyTenantAccess("loc_456");
    expect(session?.status).toBe("suspended");
  });

  it("returns null for unregistered location", async () => {
    findTenant.mockResolvedValue(null);
    const session = await verifyTenantAccess("unknown_loc");
    expect(session).toBeNull();
  });
});

describe("verifyAdminLogin", () => {
  it("returns session for valid credentials", async () => {
    const hash = crypto.createHash("sha256").update("secret123").digest("hex");
    findAdmin.mockResolvedValue({
      id: "a1",
      email: "admin@test.com",
      role: "owner",
      passwordHash: hash,
    } as never);

    const session = await verifyAdminLogin("admin@test.com", "secret123");
    expect(session).toEqual({
      adminId: "a1",
      email: "admin@test.com",
      role: "owner",
    });
  });

  it("returns null for wrong password", async () => {
    const hash = crypto.createHash("sha256").update("correct").digest("hex");
    findAdmin.mockResolvedValue({
      id: "a1",
      email: "admin@test.com",
      role: "owner",
      passwordHash: hash,
    } as never);

    const session = await verifyAdminLogin("admin@test.com", "wrong");
    expect(session).toBeNull();
  });

  it("returns null for unknown email", async () => {
    findAdmin.mockResolvedValue(null);
    const session = await verifyAdminLogin("nobody@test.com", "any");
    expect(session).toBeNull();
  });
});

describe("createAdminUser", () => {
  it("creates admin with hashed password and a random companyId", async () => {
    createAdmin.mockResolvedValue({ id: "a2" } as never);

    await createAdminUser({
      email: "new@admin.com",
      name: "New Admin",
      password: "pass123",
      role: "support",
    });

    const expectedHash = crypto.createHash("sha256").update("pass123").digest("hex");
    expect(createAdmin).toHaveBeenCalledWith({
      data: {
        email: "new@admin.com",
        name: "New Admin",
        passwordHash: expectedHash,
        role: "support",
        companyId: expect.any(String),
      },
    });
  });

  it("defaults to support role", async () => {
    createAdmin.mockResolvedValue({ id: "a3" } as never);

    await createAdminUser({ email: "x@y.com", password: "p" });

    expect(createAdmin).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "support" }),
    });
  });

  it("generates a different companyId each time", async () => {
    createAdmin.mockResolvedValue({ id: "a4" } as never);
    await createAdminUser({ email: "x@y.com", password: "p" });
    await createAdminUser({ email: "y@z.com", password: "p" });

    const [first, second] = createAdmin.mock.calls;
    expect(first[0].data.companyId).not.toEqual(second[0].data.companyId);
  });
});

describe("generateCompanyId", () => {
  it("returns a long, URL-safe, unguessable token", () => {
    const a = generateCompanyId();
    const b = generateCompanyId();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(24);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("verifyAdminByCompanyId", () => {
  it("returns session when companyId matches an admin", async () => {
    findAdmin.mockResolvedValue({
      id: "a1",
      email: "admin@test.com",
      role: "owner",
      companyId: "tok_abc123",
    } as never);

    const session = await verifyAdminByCompanyId("tok_abc123");
    expect(session).toEqual({ adminId: "a1", email: "admin@test.com", role: "owner" });
    expect(findAdmin).toHaveBeenCalledWith({ where: { companyId: "tok_abc123" } });
  });

  it("returns null for an unknown companyId", async () => {
    findAdmin.mockResolvedValue(null);
    const session = await verifyAdminByCompanyId("nope");
    expect(session).toBeNull();
  });
});
