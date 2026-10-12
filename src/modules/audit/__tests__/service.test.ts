import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { writeAuditLog, listAuditLogs } from "../service";

const create = vi.mocked(prisma.auditLog.create);
const findMany = vi.mocked(prisma.auditLog.findMany);

beforeEach(() => vi.clearAllMocks());

describe("writeAuditLog", () => {
  it("creates an audit entry", async () => {
    create.mockResolvedValue({ id: "a1" } as never);
    await writeAuditLog({
      actorType: "admin",
      actorId: "admin_1",
      action: "tenant.create",
      targetType: "tenant",
      targetId: "t1",
      tenantId: "t1",
      after: { name: "Acme" },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "admin",
        actorId: "admin_1",
        action: "tenant.create",
        targetType: "tenant",
        targetId: "t1",
        tenantId: "t1",
        after: { name: "Acme" },
      }),
    });
  });

  it("handles entries without before/after", async () => {
    create.mockResolvedValue({ id: "a2" } as never);
    await writeAuditLog({
      actorType: "system",
      actorId: "cron",
      action: "reconcile",
      targetType: "usage",
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "system",
        before: undefined,
        after: undefined,
      }),
    });
  });
});

describe("listAuditLogs", () => {
  it("returns logs ordered by createdAt desc", async () => {
    findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }] as never);
    const logs = await listAuditLogs();
    expect(logs).toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    });
  });

  it("filters by tenantId", async () => {
    findMany.mockResolvedValue([] as never);
    await listAuditLogs({ tenantId: "t1" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t1" } })
    );
  });

  it("filters by action", async () => {
    findMany.mockResolvedValue([] as never);
    await listAuditLogs({ action: "tenant.suspend" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { action: "tenant.suspend" } })
    );
  });

  it("supports limit and offset", async () => {
    findMany.mockResolvedValue([] as never);
    await listAuditLogs({ limit: 10, offset: 20 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
  });
});
