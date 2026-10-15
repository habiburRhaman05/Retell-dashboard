import * as repo from "./repository";
import { writeAuditLog } from "@/modules/audit";
import { checkLimitForLocation } from "@/modules/limits";
import type { AgentSummary } from "@/lib/retell-api";
import type { KnowledgeBase } from "@/types/retell";

// ─── Types ─────────────────────────────────────────────────

export type AssignmentStatus = "assigned" | "unassigned" | "private";

export interface AgentLibraryItem {
  agentId: string;
  agentName: string | null;
  channel: "voice" | "chat";
  status: AssignmentStatus;
  locationId: string | null;
  assignedBy: string | null;
  connectedPhoneNumbers?: string[] | null;
}

export interface KbLibraryItem {
  knowledgeBaseId: string;
  knowledgeBaseName: string | null;
  status: AssignmentStatus;
  locationId: string | null;
  assignedBy: string | null;
}

export interface AssignResult {
  assigned: number;
  skipped: string[];
}

// ─── Agent library ─────────────────────────────────────────

/** Build the full library view: all Retell agents with their assignment status. */
export async function getAgentLibrary(
  allAgents: AgentSummary[]
): Promise<AgentLibraryItem[]> {
  const [assignments, privateItems] = await Promise.all([
    repo.listAgentAssignments(),
    repo.listPrivateItems("agent"),
  ]);

  const assignMap = new Map(
    assignments.map((a) => [a.retellAgentId, a])
  );
  const privateSet = new Set(privateItems.map((p) => p.retellId));

  return allAgents.map((agent) => {
    const assignment = assignMap.get(agent.agent_id);
    if (privateSet.has(agent.agent_id)) {
      return {
        agentId: agent.agent_id,
        agentName: agent.agent_name,
        channel: agent.channel,
        status: "private" as const,
        locationId: null,
        assignedBy: null,
      };
    }
    if (assignment) {
      return {
        agentId: agent.agent_id,
        agentName: agent.agent_name,
        channel: agent.channel,
        status: "assigned" as const,
        locationId: assignment.locationId,
        assignedBy: assignment.assignedBy,
      };
    }
    return {
      agentId: agent.agent_id,
      agentName: agent.agent_name,
      channel: agent.channel,
      status: "unassigned" as const,
      locationId: null,
      assignedBy: null,
    };
  });
}

/** Assign agents to a tenant. Checks limits. Skips already-assigned or private items. */
export async function assignAgents(
  locationId: string,
  retellIds: string[],
  allAgents: AgentSummary[],
  adminId: string
): Promise<AssignResult> {
  const agentMap = new Map(allAgents.map((a) => [a.agent_id, a]));
  const [assignments, privateItems] = await Promise.all([
    repo.listAgentAssignments(),
    repo.listPrivateItems("agent"),
  ]);
  const assignedSet = new Set(assignments.map((a) => a.retellAgentId));
  const privateSet = new Set(privateItems.map((p) => p.retellId));

  const skipped: string[] = [];
  const toAssign: { retellAgentId: string; agentName: string | null }[] = [];

  for (const id of retellIds) {
    const agent = agentMap.get(id);
    if (!agent) { skipped.push(id); continue; }
    if (assignedSet.has(id)) { skipped.push(id); continue; }
    if (privateSet.has(id)) { skipped.push(id); continue; }
    toAssign.push({ retellAgentId: id, agentName: agent.agent_name });
  }

  if (toAssign.length === 0) {
    return { assigned: 0, skipped };
  }

  // Check agent limit for this location
  const limitCheck = await checkLimitForLocation(locationId, "AGENTS", toAssign.length);
  if (limitCheck.status === "block") {
    throw Object.assign(new Error(limitCheck.message), { code: "LIMIT_REACHED" });
  }

  await repo.assignAgents(locationId, toAssign, adminId);

  await writeAuditLog({
    actorType: "admin",
    actorId: adminId,
    action: "assignment.agents_assigned",
    targetType: "agents",
    targetId: locationId,
    after: { locationId, agentIds: toAssign.map((a) => a.retellAgentId) },
  });

  return { assigned: toAssign.length, skipped };
}

/** Remove agents from their assigned tenant. */
export async function unassignAgents(
  retellIds: string[],
  adminId: string
): Promise<{ unassigned: number }> {
  // Collect current assignments for audit
  const current: Record<string, string> = {};
  for (const id of retellIds) {
    const a = await repo.findAgentAssignment(id);
    if (a) current[id] = a.locationId;
  }

  const result = await repo.unassignAgents(retellIds);

  if (result.count > 0) {
    await writeAuditLog({
      actorType: "admin",
      actorId: adminId,
      action: "assignment.agents_unassigned",
      targetType: "agents",
      before: current,
      after: { agentIds: retellIds },
    });
  }

  return { unassigned: result.count };
}

/** Mark agents as private (hidden from all tenants). Removes any current assignment. */
export async function makeAgentsPrivate(
  retellIds: string[],
  adminId: string,
  reason?: string
): Promise<{ marked: number }> {
  const items = retellIds.map((id) => ({ retellId: id, itemType: "agent" as const }));
  await repo.markPrivate(items, adminId, reason);

  await writeAuditLog({
    actorType: "admin",
    actorId: adminId,
    action: "assignment.agents_made_private",
    targetType: "agents",
    after: { agentIds: retellIds, reason },
  });

  return { marked: retellIds.length };
}

/** Remove private flag from agents (they become unassigned). */
export async function makeAgentsPublic(
  retellIds: string[],
  adminId: string
): Promise<{ unmarked: number }> {
  const result = await repo.unmarkPrivate(retellIds, "agent");

  if (result.count > 0) {
    await writeAuditLog({
      actorType: "admin",
      actorId: adminId,
      action: "assignment.agents_made_public",
      targetType: "agents",
      after: { agentIds: retellIds },
    });
  }

  return { unmarked: result.count };
}

// ─── KB library ────────────────────────────────────────────

/** Build the full library view for knowledge bases. */
export async function getKbLibrary(
  allKbs: KnowledgeBase[]
): Promise<KbLibraryItem[]> {
  const [assignments, privateItems] = await Promise.all([
    repo.listKbAssignments(),
    repo.listPrivateItems("knowledge_base"),
  ]);

  const assignMap = new Map(
    assignments.map((a) => [a.retellKnowledgeBaseId, a])
  );
  const privateSet = new Set(privateItems.map((p) => p.retellId));

  return allKbs.map((kb) => {
    if (privateSet.has(kb.knowledge_base_id)) {
      return {
        knowledgeBaseId: kb.knowledge_base_id,
        knowledgeBaseName: kb.knowledge_base_name ?? null,
        status: "private" as const,
        locationId: null,
        assignedBy: null,
      };
    }
    const assignment = assignMap.get(kb.knowledge_base_id);
    if (assignment) {
      return {
        knowledgeBaseId: kb.knowledge_base_id,
        knowledgeBaseName: kb.knowledge_base_name ?? null,
        status: "assigned" as const,
        locationId: assignment.locationId,
        assignedBy: assignment.assignedBy,
      };
    }
    return {
      knowledgeBaseId: kb.knowledge_base_id,
      knowledgeBaseName: kb.knowledge_base_name ?? null,
      status: "unassigned" as const,
      locationId: null,
      assignedBy: null,
    };
  });
}

/** Assign KBs to a tenant. */
export async function assignKbs(
  locationId: string,
  retellIds: string[],
  allKbs: KnowledgeBase[],
  adminId: string
): Promise<AssignResult> {
  const kbMap = new Map(allKbs.map((kb) => [kb.knowledge_base_id, kb]));
  const [assignments, privateItems] = await Promise.all([
    repo.listKbAssignments(),
    repo.listPrivateItems("knowledge_base"),
  ]);
  const assignedSet = new Set(assignments.map((a) => a.retellKnowledgeBaseId));
  const privateSet = new Set(privateItems.map((p) => p.retellId));

  const skipped: string[] = [];
  const toAssign: { retellKnowledgeBaseId: string; knowledgeBaseName: string | null }[] = [];

  for (const id of retellIds) {
    const kb = kbMap.get(id);
    if (!kb) { skipped.push(id); continue; }
    if (assignedSet.has(id)) { skipped.push(id); continue; }
    if (privateSet.has(id)) { skipped.push(id); continue; }
    toAssign.push({ retellKnowledgeBaseId: id, knowledgeBaseName: kb.knowledge_base_name ?? null });
  }

  if (toAssign.length === 0) {
    return { assigned: 0, skipped };
  }

  const limitCheck = await checkLimitForLocation(locationId, "KNOWLEDGE_BASES", toAssign.length);
  if (limitCheck.status === "block") {
    throw Object.assign(new Error(limitCheck.message), { code: "LIMIT_REACHED" });
  }

  await repo.assignKbs(locationId, toAssign, adminId);

  await writeAuditLog({
    actorType: "admin",
    actorId: adminId,
    action: "assignment.kbs_assigned",
    targetType: "knowledge_bases",
    targetId: locationId,
    after: { locationId, kbIds: toAssign.map((k) => k.retellKnowledgeBaseId) },
  });

  return { assigned: toAssign.length, skipped };
}

/** Remove KBs from their assigned tenant. */
export async function unassignKbs(
  retellIds: string[],
  adminId: string
): Promise<{ unassigned: number }> {
  const current: Record<string, string> = {};
  for (const id of retellIds) {
    const a = await repo.findKbAssignment(id);
    if (a) current[id] = a.locationId;
  }

  const result = await repo.unassignKbs(retellIds);

  if (result.count > 0) {
    await writeAuditLog({
      actorType: "admin",
      actorId: adminId,
      action: "assignment.kbs_unassigned",
      targetType: "knowledge_bases",
      before: current,
      after: { kbIds: retellIds },
    });
  }

  return { unassigned: result.count };
}

/** Mark KBs as private. */
export async function makeKbsPrivate(
  retellIds: string[],
  adminId: string,
  reason?: string
): Promise<{ marked: number }> {
  const items = retellIds.map((id) => ({ retellId: id, itemType: "knowledge_base" as const }));
  await repo.markPrivate(items, adminId, reason);

  await writeAuditLog({
    actorType: "admin",
    actorId: adminId,
    action: "assignment.kbs_made_private",
    targetType: "knowledge_bases",
    after: { kbIds: retellIds, reason },
  });

  return { marked: retellIds.length };
}

/** Remove private flag from KBs. */
export async function makeKbsPublic(
  retellIds: string[],
  adminId: string
): Promise<{ unmarked: number }> {
  const result = await repo.unmarkPrivate(retellIds, "knowledge_base");

  if (result.count > 0) {
    await writeAuditLog({
      actorType: "admin",
      actorId: adminId,
      action: "assignment.kbs_made_public",
      targetType: "knowledge_bases",
      after: { kbIds: retellIds },
    });
  }

  return { unmarked: result.count };
}
