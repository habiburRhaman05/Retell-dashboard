import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usageEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    usageCounter: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    locationAgent: { findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
    webhookInbox: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { processCallEnded } from "../service";

const findUnique = vi.mocked(prisma.usageEvent.findUnique);
const findAgent = vi.mocked(prisma.locationAgent.findFirst);
const findTenant = vi.mocked(prisma.tenant.findUnique);
const createInbox = vi.mocked(prisma.webhookInbox.create);
const transaction = vi.mocked(prisma.$transaction);

const basePayload = {
  call_id: "call_123",
  agent_id: "agent_abc",
  call_status: "ended",
  start_timestamp: 1696100000000,
  end_timestamp: 1696100300000,
  duration_ms: 300000,
  call_cost: { combined_cost: 150 },
};

beforeEach(() => {
  vi.clearAllMocks();
  createInbox.mockResolvedValue({ id: "inbox_1" } as never);
});

describe("processCallEnded", () => {
  it("returns duplicate for already-processed call_id", async () => {
    findUnique.mockResolvedValue({ id: "existing" } as never);
    const result = await processCallEnded(basePayload);
    expect(result.status).toBe("duplicate");
    expect(result.callId).toBe("call_123");
  });

  it("stores dead letter for unknown agent_id", async () => {
    findUnique.mockResolvedValue(null);
    findAgent.mockResolvedValue(null);
    const result = await processCallEnded(basePayload);
    expect(result.status).toBe("dead_letter");
    expect(createInbox).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ error: expect.stringContaining("Unknown agent_id") }),
      })
    );
  });

  it("stores dead letter when agent has no tenant", async () => {
    findUnique.mockResolvedValue(null);
    findAgent.mockResolvedValue({ locationId: "loc_1" } as never);
    findTenant.mockResolvedValue(null);
    const result = await processCallEnded(basePayload);
    expect(result.status).toBe("dead_letter");
    expect(result).toHaveProperty("reason", "no_tenant");
  });

  it("processes valid call and creates usage event", async () => {
    findUnique.mockResolvedValue(null);
    findAgent.mockResolvedValue({ locationId: "loc_1" } as never);
    findTenant.mockResolvedValue({ id: "tenant_1" } as never);
    transaction.mockImplementation(async (fn) => {
      const fakeTx = {
        usageEvent: {
          create: vi.fn().mockResolvedValue({ id: "event_1", callId: "call_123" }),
        },
        usageCounter: { upsert: vi.fn().mockResolvedValue({}) },
      };
      return fn(fakeTx as never);
    });

    const result = await processCallEnded(basePayload);
    expect(result.status).toBe("processed");
    expect(result.callId).toBe("call_123");
  });

  it("calculates duration in seconds from duration_ms", async () => {
    findUnique.mockResolvedValue(null);
    findAgent.mockResolvedValue({ locationId: "loc_1" } as never);
    findTenant.mockResolvedValue({ id: "tenant_1" } as never);
    let capturedData: Record<string, unknown> = {};
    transaction.mockImplementation(async (fn) => {
      const fakeTx = {
        usageEvent: {
          create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            capturedData = args.data;
            return { id: "event_1", callId: "call_123" };
          }),
        },
        usageCounter: { upsert: vi.fn().mockResolvedValue({}) },
      };
      return fn(fakeTx as never);
    });

    await processCallEnded({ ...basePayload, duration_ms: 65000 });
    expect(capturedData.durationSec).toBe(65);
  });

  it("handles missing duration gracefully", async () => {
    findUnique.mockResolvedValue(null);
    findAgent.mockResolvedValue({ locationId: "loc_1" } as never);
    findTenant.mockResolvedValue({ id: "tenant_1" } as never);
    let capturedData: Record<string, unknown> = {};
    transaction.mockImplementation(async (fn) => {
      const fakeTx = {
        usageEvent: {
          create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            capturedData = args.data;
            return { id: "event_1", callId: "call_123" };
          }),
        },
        usageCounter: { upsert: vi.fn().mockResolvedValue({}) },
      };
      return fn(fakeTx as never);
    });

    await processCallEnded({ ...basePayload, duration_ms: undefined });
    expect(capturedData.durationSec).toBeNull();
  });
});
