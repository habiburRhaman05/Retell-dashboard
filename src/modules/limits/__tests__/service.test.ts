import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    limitPolicy: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    locationAgent: { count: vi.fn() },
    locationKnowledgeBase: { count: vi.fn() },
    usageCounter: { findUnique: vi.fn(), findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  checkLimit,
  checkLimitAtomic,
  getLimitPolicy,
  getAllLimitPolicies,
  setLimitPolicy,
  deleteLimitPolicy,
} from "../service";

const mockLimitPolicy = vi.mocked(prisma.limitPolicy);
const mockTenant = vi.mocked(prisma.tenant.findUnique);
const mockAgentCount = vi.mocked(prisma.locationAgent.count);
const mockKBCount = vi.mocked(prisma.locationKnowledgeBase.count);
const mockCounterFind = vi.mocked(prisma.usageCounter.findUnique);

beforeEach(() => vi.clearAllMocks());

describe("checkLimit", () => {
  it("returns allow when no policy exists", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue(null);
    const result = await checkLimit("t1", "AGENTS");
    expect(result).toEqual({ status: "allow" });
  });

  it("returns allow when usage is under limit", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue({
      id: "p1", tenantId: "t1", metric: "AGENTS", period: "monthly",
      limitValue: 10, warnAtPct: 80, mode: "hard",
      createdAt: new Date(), updatedAt: new Date(),
    } as never);
    mockTenant.mockResolvedValue({ crmLocationId: "loc_1" } as never);
    mockAgentCount.mockResolvedValue(3);
    const result = await checkLimit("t1", "AGENTS");
    expect(result).toEqual({ status: "allow" });
  });

  it("returns warn when usage reaches warn threshold", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue({
      id: "p1", tenantId: "t1", metric: "AGENTS", period: "monthly",
      limitValue: 10, warnAtPct: 80, mode: "hard",
      createdAt: new Date(), updatedAt: new Date(),
    } as never);
    mockTenant.mockResolvedValue({ crmLocationId: "loc_1" } as never);
    mockAgentCount.mockResolvedValue(8); // 8+1=9 >= 8 (80% of 10)
    const result = await checkLimit("t1", "AGENTS");
    expect(result).toEqual({
      status: "warn",
      used: 8,
      limit: 10,
      metric: "AGENTS",
    });
  });

  it("returns block when usage exceeds limit in hard mode", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue({
      id: "p1", tenantId: "t1", metric: "AGENTS", period: "monthly",
      limitValue: 5, warnAtPct: 80, mode: "hard",
      createdAt: new Date(), updatedAt: new Date(),
    } as never);
    mockTenant.mockResolvedValue({ crmLocationId: "loc_1" } as never);
    mockAgentCount.mockResolvedValue(5); // 5+1=6 > 5
    const result = await checkLimit("t1", "AGENTS");
    expect(result.status).toBe("block");
    if (result.status === "block") {
      expect(result.used).toBe(5);
      expect(result.limit).toBe(5);
      expect(result.message).toContain("Limit reached");
    }
  });

  it("returns warn instead of block in soft mode", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue({
      id: "p1", tenantId: "t1", metric: "AGENTS", period: "monthly",
      limitValue: 5, warnAtPct: 80, mode: "soft",
      createdAt: new Date(), updatedAt: new Date(),
    } as never);
    mockTenant.mockResolvedValue({ crmLocationId: "loc_1" } as never);
    mockAgentCount.mockResolvedValue(5); // over limit, but soft mode
    const result = await checkLimit("t1", "AGENTS");
    expect(result).toEqual({
      status: "warn",
      used: 5,
      limit: 5,
      metric: "AGENTS",
    });
  });

  it("counts KNOWLEDGE_BASES from locationKnowledgeBase table", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue({
      id: "p1", tenantId: "t1", metric: "KNOWLEDGE_BASES", period: "monthly",
      limitValue: 3, warnAtPct: 80, mode: "hard",
      createdAt: new Date(), updatedAt: new Date(),
    } as never);
    mockTenant.mockResolvedValue({ crmLocationId: "loc_1" } as never);
    mockKBCount.mockResolvedValue(3); // 3+1=4 > 3
    const result = await checkLimit("t1", "KNOWLEDGE_BASES");
    expect(result.status).toBe("block");
  });

  it("reads CALL_MINUTES from usage counter for monthly period", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue({
      id: "p1", tenantId: "t1", metric: "CALL_MINUTES", period: "monthly",
      limitValue: 100, warnAtPct: 80, mode: "hard",
      createdAt: new Date(), updatedAt: new Date(),
    } as never);
    mockCounterFind.mockResolvedValue({ value: 50 } as never);
    const result = await checkLimit("t1", "CALL_MINUTES");
    expect(result).toEqual({ status: "allow" });
  });

  it("sums all counters for lifetime period", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue({
      id: "p1", tenantId: "t1", metric: "CALLS", period: "lifetime",
      limitValue: 100, warnAtPct: 80, mode: "hard",
      createdAt: new Date(), updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.usageCounter.findMany).mockResolvedValue([
      { value: 40 },
      { value: 50 },
      { value: 15 },
    ] as never);
    const result = await checkLimit("t1", "CALLS");
    // 105+1=106 > 100
    expect(result.status).toBe("block");
  });

  it("returns allow when counter is zero and no policy exists", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue(null);
    const result = await checkLimit("t1", "CALL_MINUTES");
    expect(result).toEqual({ status: "allow" });
  });
});

describe("checkLimitAtomic", () => {
  it("runs inside a transaction", async () => {
    const mockTx = {
      limitPolicy: { findUnique: vi.fn().mockResolvedValue(null) },
      locationAgent: { count: vi.fn() },
      tenant: { findUnique: vi.fn() },
      usageCounter: { findUnique: vi.fn(), findMany: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      return (fn as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
    });
    const result = await checkLimitAtomic("t1", "AGENTS");
    expect(result).toEqual({ status: "allow" });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("blocks inside transaction when at limit in hard mode", async () => {
    const mockTx = {
      limitPolicy: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p1", tenantId: "t1", metric: "AGENTS", period: "monthly",
          limitValue: 2, warnAtPct: 80, mode: "hard",
        }),
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ crmLocationId: "loc_1" }) },
      locationAgent: { count: vi.fn().mockResolvedValue(2) },
      usageCounter: { findUnique: vi.fn(), findMany: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      return (fn as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
    });
    const result = await checkLimitAtomic("t1", "AGENTS");
    expect(result.status).toBe("block");
  });
});

describe("getLimitPolicy", () => {
  it("returns the policy for a tenant and metric", async () => {
    const policy = { id: "p1", tenantId: "t1", metric: "AGENTS", limitValue: 10 };
    mockLimitPolicy.findUnique.mockResolvedValue(policy as never);
    const result = await getLimitPolicy("t1", "AGENTS");
    expect(result).toEqual(policy);
  });

  it("returns null when no policy exists", async () => {
    mockLimitPolicy.findUnique.mockResolvedValue(null);
    const result = await getLimitPolicy("t1", "AGENTS");
    expect(result).toBeNull();
  });
});

describe("getAllLimitPolicies", () => {
  it("returns all policies for a tenant", async () => {
    const policies = [
      { id: "p1", metric: "AGENTS", limitValue: 10 },
      { id: "p2", metric: "CALLS", limitValue: 100 },
    ];
    mockLimitPolicy.findMany.mockResolvedValue(policies as never);
    const result = await getAllLimitPolicies("t1");
    expect(result).toEqual(policies);
    expect(mockLimitPolicy.findMany).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
  });
});

describe("setLimitPolicy", () => {
  it("upserts with provided values", async () => {
    const policy = { id: "p1", tenantId: "t1", metric: "AGENTS", limitValue: 15 };
    mockLimitPolicy.upsert.mockResolvedValue(policy as never);
    const result = await setLimitPolicy("t1", "AGENTS", {
      limitValue: 15,
      period: "monthly",
      warnAtPct: 90,
      mode: "soft",
    });
    expect(result).toEqual(policy);
    expect(mockLimitPolicy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_metric: { tenantId: "t1", metric: "AGENTS" } },
        create: expect.objectContaining({ limitValue: 15, warnAtPct: 90, mode: "soft" }),
      })
    );
  });

  it("uses defaults when optional values omitted", async () => {
    mockLimitPolicy.upsert.mockResolvedValue({} as never);
    await setLimitPolicy("t1", "CALLS", { limitValue: 50 });
    expect(mockLimitPolicy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          period: "monthly",
          warnAtPct: 80,
          mode: "hard",
        }),
      })
    );
  });
});

describe("deleteLimitPolicy", () => {
  it("deletes the policy by tenant and metric", async () => {
    mockLimitPolicy.delete.mockResolvedValue({} as never);
    await deleteLimitPolicy("t1", "AGENTS");
    expect(mockLimitPolicy.delete).toHaveBeenCalledWith({
      where: { tenantId_metric: { tenantId: "t1", metric: "AGENTS" } },
    });
  });
});
