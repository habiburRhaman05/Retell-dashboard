import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import * as service from "../service";

const findUnique = vi.mocked(prisma.tenant.findUnique);
const findMany = vi.mocked(prisma.tenant.findMany);
const create = vi.mocked(prisma.tenant.create);
const update = vi.mocked(prisma.tenant.update);

beforeEach(() => vi.clearAllMocks());

describe("getTenantByLocationId", () => {
  it("returns tenant when found", async () => {
    const tenant = { id: "t1", crmLocationId: "loc1", name: "Acme", status: "active" };
    findUnique.mockResolvedValue(tenant as never);
    const result = await service.getTenantByLocationId("loc1");
    expect(result).toEqual(tenant);
    expect(findUnique).toHaveBeenCalledWith({ where: { crmLocationId: "loc1" } });
  });

  it("returns null when not found", async () => {
    findUnique.mockResolvedValue(null);
    const result = await service.getTenantByLocationId("unknown");
    expect(result).toBeNull();
  });
});

describe("registerTenant", () => {
  it("creates a new tenant", async () => {
    findUnique.mockResolvedValue(null);
    const newTenant = { id: "t2", crmLocationId: "loc2", name: "NewCo", status: "active" };
    create.mockResolvedValue(newTenant as never);

    const result = await service.registerTenant({
      crmLocationId: "loc2",
      name: "NewCo",
      email: "a@b.com",
    });
    expect(result.name).toBe("NewCo");
    expect(create).toHaveBeenCalled();
  });

  it("rejects duplicate location ID", async () => {
    findUnique.mockResolvedValue({ id: "t1", crmLocationId: "loc1" } as never);
    await expect(
      service.registerTenant({ crmLocationId: "loc1", name: "Dup" })
    ).rejects.toThrow("A tenant with this location ID already exists");
  });
});

describe("listAllTenants", () => {
  it("returns all tenants ordered by createdAt desc", async () => {
    findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }] as never);
    const result = await service.listAllTenants();
    expect(result).toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "desc" } });
  });
});

describe("suspendTenant", () => {
  it("sets status to suspended", async () => {
    update.mockResolvedValue({ id: "t1", status: "suspended" } as never);
    await service.suspendTenant("t1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "suspended" },
    });
  });
});

describe("reactivateTenant", () => {
  it("sets status to active", async () => {
    update.mockResolvedValue({ id: "t1", status: "active" } as never);
    await service.reactivateTenant("t1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "active" },
    });
  });
});
