import { prisma } from "@/lib/prisma";
import * as repo from "./repository";

export interface CallEndedPayload {
  call_id: string;
  agent_id: string;
  call_status: string;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  call_cost?: { combined_cost?: number };
  [key: string]: unknown;
}

export async function processCallEnded(payload: CallEndedPayload) {
  const alreadyProcessed = await repo.usageEventExists(payload.call_id);
  if (alreadyProcessed) {
    return { status: "duplicate" as const, callId: payload.call_id };
  }

  const agentMapping = await prisma.locationAgent.findFirst({
    where: { retellAgentId: payload.agent_id },
    select: { locationId: true },
  });

  if (!agentMapping) {
    await prisma.webhookInbox.create({
      data: {
        eventType: "call_ended",
        callId: payload.call_id,
        rawBody: JSON.stringify(payload),
        signatureValid: true,
        error: `Unknown agent_id: ${payload.agent_id}`,
      },
    });
    return { status: "dead_letter" as const, callId: payload.call_id, reason: "unknown_agent" };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { crmLocationId: agentMapping.locationId },
    select: { id: true },
  });

  if (!tenant) {
    await prisma.webhookInbox.create({
      data: {
        eventType: "call_ended",
        callId: payload.call_id,
        rawBody: JSON.stringify(payload),
        signatureValid: true,
        error: `No tenant for location: ${agentMapping.locationId}`,
      },
    });
    return { status: "dead_letter" as const, callId: payload.call_id, reason: "no_tenant" };
  }

  const startedAt = payload.start_timestamp
    ? new Date(payload.start_timestamp)
    : new Date();
  const endedAt = payload.end_timestamp
    ? new Date(payload.end_timestamp)
    : new Date();
  const durationSec = payload.duration_ms != null
    ? Math.round(payload.duration_ms / 1000)
    : null;
  const costCents = payload.call_cost?.combined_cost != null
    ? Math.round(payload.call_cost.combined_cost)
    : null;

  const event = await repo.insertUsageEvent({
    callId: payload.call_id,
    tenantId: tenant.id,
    agentId: payload.agent_id,
    eventType: "call_ended",
    durationSec,
    costCents,
    startedAt,
    endedAt,
    rawPayload: payload,
  });

  return { status: "processed" as const, callId: payload.call_id, eventId: event.id };
}

export { getUsageCounter, getUsageCounters, getUsageEvents, getUsageSummary } from "./repository";
export { monthlyPeriodStart, periodKey } from "./period";
