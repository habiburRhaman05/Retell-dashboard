import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationAgent: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    locationKnowledgeBase: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    privateRetellItem: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    location: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/modules/limits", () => ({
  checkLimitForLocation: vi.fn().mockResolvedValue({ status: "allow" }),
}));

import { prisma } from "@/lib/prisma";
import { checkLimitForLocation } from "@/modules/limits";
import {
  getAgentLibrary,
  assignAgents,
  unassignAgents,
  makeAgentsPrivate,
  makeAgentsPublic,
  getKbLibrary,
  assignKbs,
  unassignKbs,
  makeKbsPrivate,
  makeKbsPublic,
} from "../service";
import type { AgentSummary } from "@/lib/retell-api";

const mockAgents: AgentSummary[] = [
  { agent_id: "a1", agent_name: "Agent 1", channel: "voice", last_modification_timestamp: 1 },
  { agent_id: "a2", agent_name: "Agent 2", channel: "chat", last_modification_timestamp: 2 },
  { agent_id: "a3", agent_name: "Agent 3", channel: "voice", last_modification_timestamp: 3 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  vi.mocked(prisma.location.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.locationAgent.createMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.locationAgent.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.locationKnowledgeBase.createMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.locationKnowledgeBase.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.privateRetellItem.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(checkLimitForLocation).mockResolvedValue({ status: "allow" } as never);
});

describe("getAgentLibrary", () => {
  it("marks agents as assigned, unassigned, or private", async () => {
    vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([
      { retellAgentId: "a1", locationId: "loc1", agentName: "Agent 1", assignedBy: "admin1", createdAt: new Date() },
    ] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([
      { retellId: "a3", itemType: "agent", markedBy: "admin1", reason: null, createdAt: new Date() },
    ] as never);

    const library = await getAgentLibrary(mockAgents);

    expect(library).toHaveLength(3);
    expect(library.find((a) => a.agentId === "a1")?.status).toBe("assigned");
    expect(library.find((a) => a.agentId === "a1")?.locationId).toBe("loc1");
    expect(library.find((a) => a.agentId === "a2")?.status).toBe("unassigned");
    expect(library.find((a) => a.agentId === "a3")?.status).toBe("private");
  });

  it("returns empty array for no agents", async () => {
    vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);

    const library = await getAgentLibrary([]);
    expect(library).toEqual([]);
  });
});

describe("assignAgents", () => {
  it("assigns unassigned agents and audits", async () => {
    vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);

    const result = await assignAgents("loc1", ["a1", "a2"], mockAgents, "admin1");

    expect(result.assigned).toBe(2);
    expect(result.skipped).toEqual([]);
    expect(prisma.locationAgent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ retellAgentId: "a1", locationId: "loc1" }),
          expect.objectContaining({ retellAgentId: "a2", locationId: "loc1" }),
        ]),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("skips already-assigned agents", async () => {
    vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([
      { retellAgentId: "a1", locationId: "loc2" },
    ] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);

    const result = await assignAgents("loc1", ["a1", "a2"], mockAgents, "admin1");

    expect(result.assigned).toBe(1);
    expect(result.skipped).toEqual(["a1"]);
  });

  it("skips private agents", async () => {
    vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([
      { retellId: "a1", itemType: "agent" },
    ] as never);

    const result = await assignAgents("loc1", ["a1", "a2"], mockAgents, "admin1");

    expect(result.assigned).toBe(1);
    expect(result.skipped).toEqual(["a1"]);
  });

  it("skips IDs not in Retell", async () => {
    vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);

    const result = await assignAgents("loc1", ["nonexistent", "a1"], mockAgents, "admin1");

    expect(result.assigned).toBe(1);
    expect(result.skipped).toEqual(["nonexistent"]);
  });

  it("throws LIMIT_REACHED when over limit", async () => {
    vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);
    vi.mocked(checkLimitForLocation).mockResolvedValue({
      status: "block",
      message: "Agent limit reached",
    } as never);

    await expect(
      assignAgents("loc1", ["a1"], mockAgents, "admin1")
    ).rejects.toThrow("Agent limit reached");
  });

  it("returns 0 assigned when nothing to assign", async () => {
    vi.mocked(prisma.locationAgent.findMany).mockResolvedValue([
      { retellAgentId: "a1", locationId: "loc2" },
    ] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);

    const result = await assignAgents("loc1", ["a1"], mockAgents, "admin1");

    expect(result.assigned).toBe(0);
    expect(prisma.locationAgent.createMany).not.toHaveBeenCalled();
  });
});

describe("unassignAgents", () => {
  it("unassigns agents and audits", async () => {
    vi.mocked(prisma.locationAgent.findFirst).mockResolvedValue(
      { id: "la1", locationId: "loc1", agentName: "A1", assignedBy: "admin1" } as never
    );
    vi.mocked(prisma.locationAgent.deleteMany).mockResolvedValue({ count: 1 } as never);

    const result = await unassignAgents(["a1"], "admin1");

    expect(result.unassigned).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("does not audit if nothing was unassigned", async () => {
    vi.mocked(prisma.locationAgent.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.locationAgent.deleteMany).mockResolvedValue({ count: 0 } as never);

    await unassignAgents(["nonexistent"], "admin1");

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("makeAgentsPrivate", () => {
  it("marks agents private, removes assignments, and audits", async () => {
    const result = await makeAgentsPrivate(["a1", "a2"], "admin1", "Internal use");

    expect(result.marked).toBe(2);
    // Should remove any existing assignments
    expect(prisma.locationAgent.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { retellAgentId: { in: ["a1", "a2"] } },
      })
    );
    // Should upsert private items
    expect(prisma.privateRetellItem.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("makeAgentsPublic", () => {
  it("removes private flag and audits", async () => {
    vi.mocked(prisma.privateRetellItem.deleteMany).mockResolvedValue({ count: 2 } as never);

    const result = await makeAgentsPublic(["a1", "a2"], "admin1");

    expect(result.unmarked).toBe(2);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("getKbLibrary", () => {
  it("marks KBs as assigned, unassigned, or private", async () => {
    const allKbs = [
      { knowledge_base_id: "kb1", knowledge_base_name: "KB 1" },
      { knowledge_base_id: "kb2", knowledge_base_name: "KB 2" },
    ] as never[];

    vi.mocked(prisma.locationKnowledgeBase.findMany).mockResolvedValue([
      { retellKnowledgeBaseId: "kb1", locationId: "loc1", knowledgeBaseName: "KB 1", assignedBy: "admin1", createdAt: new Date() },
    ] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);

    const library = await getKbLibrary(allKbs);

    expect(library).toHaveLength(2);
    expect(library.find((k) => k.knowledgeBaseId === "kb1")?.status).toBe("assigned");
    expect(library.find((k) => k.knowledgeBaseId === "kb2")?.status).toBe("unassigned");
  });
});

describe("assignKbs", () => {
  it("assigns KBs and audits", async () => {
    const allKbs = [
      { knowledge_base_id: "kb1", knowledge_base_name: "KB 1" },
    ] as never[];

    vi.mocked(prisma.locationKnowledgeBase.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);

    const result = await assignKbs("loc1", ["kb1"], allKbs, "admin1");

    expect(result.assigned).toBe(1);
    expect(prisma.locationKnowledgeBase.createMany).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("throws LIMIT_REACHED for KBs", async () => {
    const allKbs = [{ knowledge_base_id: "kb1", knowledge_base_name: "KB 1" }] as never[];
    vi.mocked(prisma.locationKnowledgeBase.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.privateRetellItem.findMany).mockResolvedValue([] as never);
    vi.mocked(checkLimitForLocation).mockResolvedValue({
      status: "block",
      message: "KB limit reached",
    } as never);

    await expect(assignKbs("loc1", ["kb1"], allKbs, "admin1")).rejects.toThrow("KB limit reached");
  });
});

describe("unassignKbs", () => {
  it("unassigns and audits", async () => {
    vi.mocked(prisma.locationKnowledgeBase.findFirst).mockResolvedValue(
      { id: "lkb1", locationId: "loc1" } as never
    );
    vi.mocked(prisma.locationKnowledgeBase.deleteMany).mockResolvedValue({ count: 1 } as never);

    const result = await unassignKbs(["kb1"], "admin1");

    expect(result.unassigned).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("makeKbsPrivate", () => {
  it("marks KBs private and removes assignments", async () => {
    const result = await makeKbsPrivate(["kb1"], "admin1");

    expect(result.marked).toBe(1);
    expect(prisma.locationKnowledgeBase.deleteMany).toHaveBeenCalled();
    expect(prisma.privateRetellItem.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("makeKbsPublic", () => {
  it("removes private flag", async () => {
    vi.mocked(prisma.privateRetellItem.deleteMany).mockResolvedValue({ count: 1 } as never);

    const result = await makeKbsPublic(["kb1"], "admin1");

    expect(result.unmarked).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
