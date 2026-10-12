import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    tenantFeature: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    featureLock: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    limitPolicy: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  checkAccess,
  createFeatureLock,
  clearFeatureLock,
  getActiveFeatureLocks,
  setFeatureEnabled,
  getFeatureStatus,
  getAllFeatures,
} from "../service";

const mockTenant = vi.mocked(prisma.tenant.findUnique);
const mockFeature = vi.mocked(prisma.tenantFeature.findUnique);
const mockFeatureMany = vi.mocked(prisma.tenantFeature.findMany);
const mockFeatureUpsert = vi.mocked(prisma.tenantFeature.upsert);
const mockLockFind = vi.mocked(prisma.featureLock.findFirst);
const mockLockMany = vi.mocked(prisma.featureLock.findMany);
const mockLockCreate = vi.mocked(prisma.featureLock.create);
const mockLockUpdate = vi.mocked(prisma.featureLock.updateMany);
const mockPolicy = vi.mocked(prisma.limitPolicy.findUnique);

beforeEach(() => vi.clearAllMocks());

describe("checkAccess", () => {
  it("denies if tenant is suspended", async () => {
    mockTenant.mockResolvedValue({ status: "suspended" } as never);
    const result = await checkAccess("t1", "agents.create");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("ACCOUNT_SUSPENDED");
    }
  });

  it("denies if tenant not found", async () => {
    mockTenant.mockResolvedValue(null);
    const result = await checkAccess("t1", "agents.create");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("ACCOUNT_SUSPENDED");
    }
  });

  it("denies if feature is explicitly disabled", async () => {
    mockTenant.mockResolvedValue({ status: "active" } as never);
    mockFeature.mockResolvedValue({ enabled: false, reason: "Disabled by admin" } as never);
    const result = await checkAccess("t1", "agents.create");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("FEATURE_DISABLED");
      expect(result.reason).toBe("Disabled by admin");
    }
  });

  it("denies if feature has an active lock (LIMIT_REACHED)", async () => {
    mockTenant.mockResolvedValue({ status: "active" } as never);
    mockFeature.mockResolvedValue(null); // no explicit feature row = enabled
    mockLockFind.mockResolvedValue({
      id: "lock1", tenantId: "t1", featureKey: "agents.create",
      metric: "AGENTS", reason: "Agent limit reached",
    } as never);
    mockPolicy.mockResolvedValue({ limitValue: 5 } as never);

    const result = await checkAccess("t1", "agents.create", "AGENTS");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("LIMIT_REACHED");
    }
  });

  it("allows when tenant is active and no restrictions", async () => {
    mockTenant.mockResolvedValue({ status: "active" } as never);
    mockFeature.mockResolvedValue(null);
    const result = await checkAccess("t1", "agents.create");
    expect(result.allowed).toBe(true);
  });

  it("allows when feature is explicitly enabled and no lock", async () => {
    mockTenant.mockResolvedValue({ status: "active" } as never);
    mockFeature.mockResolvedValue({ enabled: true, reason: null } as never);
    mockLockFind.mockResolvedValue(null);
    const result = await checkAccess("t1", "agents.create", "AGENTS");
    expect(result.allowed).toBe(true);
  });

  it("does not check locks when no metric is provided", async () => {
    mockTenant.mockResolvedValue({ status: "active" } as never);
    mockFeature.mockResolvedValue(null);
    const result = await checkAccess("t1", "agents.create");
    expect(result.allowed).toBe(true);
    expect(mockLockFind).not.toHaveBeenCalled();
  });

  it("3-switch independence: re-enabling feature doesn't clear limit lock", async () => {
    mockTenant.mockResolvedValue({ status: "active" } as never);
    mockFeature.mockResolvedValue({ enabled: true, reason: null } as never);
    mockLockFind.mockResolvedValue({
      id: "lock1", reason: "Limit reached",
    } as never);
    mockPolicy.mockResolvedValue({ limitValue: 5 } as never);

    const result = await checkAccess("t1", "agents.create", "AGENTS");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("LIMIT_REACHED");
    }
  });
});

describe("createFeatureLock", () => {
  it("creates a new lock when none exists", async () => {
    mockLockFind.mockResolvedValue(null);
    const newLock = { id: "lock1", tenantId: "t1", featureKey: "agents.create", metric: "AGENTS" };
    mockLockCreate.mockResolvedValue(newLock as never);
    const result = await createFeatureLock("t1", "agents.create", "AGENTS", "Limit reached");
    expect(result).toEqual(newLock);
    expect(mockLockCreate).toHaveBeenCalled();
  });

  it("returns existing lock when one is already active (idempotent)", async () => {
    const existing = { id: "lock1", tenantId: "t1", featureKey: "agents.create", metric: "AGENTS" };
    mockLockFind.mockResolvedValue(existing as never);
    const result = await createFeatureLock("t1", "agents.create", "AGENTS", "Limit reached");
    expect(result).toEqual(existing);
    expect(mockLockCreate).not.toHaveBeenCalled();
  });
});

describe("clearFeatureLock", () => {
  it("sets clearedAt on matching active locks", async () => {
    mockLockUpdate.mockResolvedValue({ count: 1 } as never);
    await clearFeatureLock("t1", "agents.create", "AGENTS");
    expect(mockLockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          featureKey: "agents.create",
          metric: "AGENTS",
          clearedAt: null,
        }),
        data: expect.objectContaining({ clearedAt: expect.any(Date) }),
      })
    );
  });

  it("clears all locks for a feature when no metric specified", async () => {
    mockLockUpdate.mockResolvedValue({ count: 2 } as never);
    await clearFeatureLock("t1", "agents.create");
    const call = mockLockUpdate.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.metric).toBeUndefined();
  });
});

describe("getActiveFeatureLocks", () => {
  it("returns only active (non-cleared) locks", async () => {
    const locks = [{ id: "lock1" }, { id: "lock2" }];
    mockLockMany.mockResolvedValue(locks as never);
    const result = await getActiveFeatureLocks("t1");
    expect(result).toEqual(locks);
    expect(mockLockMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", clearedAt: null },
    });
  });
});

describe("setFeatureEnabled", () => {
  it("upserts the feature toggle", async () => {
    const feature = { id: "f1", tenantId: "t1", featureKey: "agents.create", enabled: false };
    mockFeatureUpsert.mockResolvedValue(feature as never);
    const result = await setFeatureEnabled("t1", "agents.create", false, "Admin disabled", "admin1");
    expect(result).toEqual(feature);
    expect(mockFeatureUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_featureKey: { tenantId: "t1", featureKey: "agents.create" } },
        create: expect.objectContaining({
          tenantId: "t1",
          featureKey: "agents.create",
          enabled: false,
          reason: "Admin disabled",
          changedBy: "admin1",
        }),
      })
    );
  });
});

describe("getFeatureStatus", () => {
  it("returns the stored feature status", async () => {
    const feature = { featureKey: "agents.create", enabled: false, reason: "Disabled" };
    mockFeature.mockResolvedValue(feature as never);
    const result = await getFeatureStatus("t1", "agents.create");
    expect(result).toEqual(feature);
  });

  it("returns default enabled=true when no record exists", async () => {
    mockFeature.mockResolvedValue(null);
    const result = await getFeatureStatus("t1", "agents.create");
    expect(result).toEqual({ featureKey: "agents.create", enabled: true, reason: null });
  });
});

describe("getAllFeatures", () => {
  it("returns all feature records for a tenant", async () => {
    const features = [
      { featureKey: "agents.create", enabled: true },
      { featureKey: "calls.make", enabled: false },
    ];
    mockFeatureMany.mockResolvedValue(features as never);
    const result = await getAllFeatures("t1");
    expect(result).toEqual(features);
    expect(mockFeatureMany).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
  });
});
