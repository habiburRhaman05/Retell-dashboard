import { prisma } from "@/lib/prisma";
import type { RetellItemType } from "@prisma/client";

// ─── Agent assignments ─────────────────────────────────────

export async function listAgentAssignments() {
  return prisma.locationAgent.findMany({
    select: {
      retellAgentId: true,
      locationId: true,
      agentName: true,
      assignedBy: true,
      createdAt: true,
    },
  });
}

export async function findAgentAssignment(retellAgentId: string) {
  return prisma.locationAgent.findFirst({
    where: { retellAgentId },
    select: { id: true, locationId: true, agentName: true, assignedBy: true },
  });
}

export async function assignAgents(
  locationId: string,
  items: { retellAgentId: string; agentName: string | null }[],
  assignedBy: string
) {
  // Ensure the Location row exists
  await prisma.location.upsert({
    where: { locationId },
    create: { locationId },
    update: {},
  });

  return prisma.locationAgent.createMany({
    data: items.map((item) => ({
      locationId,
      retellAgentId: item.retellAgentId,
      agentName: item.agentName,
      assignedBy,
    })),
    skipDuplicates: true,
  });
}

export async function unassignAgents(retellAgentIds: string[]) {
  return prisma.locationAgent.deleteMany({
    where: { retellAgentId: { in: retellAgentIds } },
  });
}

export async function countAgentsForLocation(locationId: string) {
  return prisma.locationAgent.count({ where: { locationId } });
}

// ─── KB assignments ────────────────────────────────────────

export async function listKbAssignments() {
  return prisma.locationKnowledgeBase.findMany({
    select: {
      retellKnowledgeBaseId: true,
      locationId: true,
      knowledgeBaseName: true,
      assignedBy: true,
      createdAt: true,
    },
  });
}

export async function findKbAssignment(retellKnowledgeBaseId: string) {
  return prisma.locationKnowledgeBase.findFirst({
    where: { retellKnowledgeBaseId },
    select: { id: true, locationId: true, knowledgeBaseName: true, assignedBy: true },
  });
}

export async function assignKbs(
  locationId: string,
  items: { retellKnowledgeBaseId: string; knowledgeBaseName: string | null }[],
  assignedBy: string
) {
  await prisma.location.upsert({
    where: { locationId },
    create: { locationId },
    update: {},
  });

  return prisma.locationKnowledgeBase.createMany({
    data: items.map((item) => ({
      locationId,
      retellKnowledgeBaseId: item.retellKnowledgeBaseId,
      knowledgeBaseName: item.knowledgeBaseName,
      assignedBy,
    })),
    skipDuplicates: true,
  });
}

export async function unassignKbs(retellKnowledgeBaseIds: string[]) {
  return prisma.locationKnowledgeBase.deleteMany({
    where: { retellKnowledgeBaseId: { in: retellKnowledgeBaseIds } },
  });
}

export async function countKbsForLocation(locationId: string) {
  return prisma.locationKnowledgeBase.count({ where: { locationId } });
}

// ─── Private items ─────────────────────────────────────────

export async function listPrivateItems(itemType?: RetellItemType) {
  const where = itemType ? { itemType } : {};
  return prisma.privateRetellItem.findMany({
    where,
    select: { retellId: true, itemType: true, markedBy: true, reason: true, createdAt: true },
  });
}

export async function markPrivate(
  items: { retellId: string; itemType: RetellItemType }[],
  markedBy: string,
  reason?: string
) {
  // First remove any assignments for these items
  const agentIds = items.filter((i) => i.itemType === "agent").map((i) => i.retellId);
  const kbIds = items.filter((i) => i.itemType === "knowledge_base").map((i) => i.retellId);

  if (agentIds.length > 0) {
    await prisma.locationAgent.deleteMany({ where: { retellAgentId: { in: agentIds } } });
  }
  if (kbIds.length > 0) {
    await prisma.locationKnowledgeBase.deleteMany({ where: { retellKnowledgeBaseId: { in: kbIds } } });
  }

  // Then mark them private (skipDuplicates in case some already are)
  for (const item of items) {
    await prisma.privateRetellItem.upsert({
      where: { retellId_itemType: { retellId: item.retellId, itemType: item.itemType } },
      create: { retellId: item.retellId, itemType: item.itemType, markedBy, reason },
      update: { markedBy, reason },
    });
  }
}

export async function unmarkPrivate(retellIds: string[], itemType: RetellItemType) {
  return prisma.privateRetellItem.deleteMany({
    where: { retellId: { in: retellIds }, itemType },
  });
}

export async function isPrivate(retellId: string, itemType: RetellItemType) {
  const item = await prisma.privateRetellItem.findUnique({
    where: { retellId_itemType: { retellId, itemType } },
  });
  return item !== null;
}
