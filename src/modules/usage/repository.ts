import { prisma } from "@/lib/prisma";
import type { MetricType } from "@prisma/client";
import { monthlyPeriodStart } from "./period";

export async function insertUsageEvent(data: {
  callId: string;
  tenantId: string;
  agentId: string;
  eventType: string;
  durationSec: number | null;
  costCents: number | null;
  startedAt: Date;
  endedAt: Date;
  rawPayload: unknown;
}) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.usageEvent.create({
      data: {
        callId: data.callId,
        tenantId: data.tenantId,
        agentId: data.agentId,
        eventType: data.eventType,
        durationSec: data.durationSec,
        costCents: data.costCents,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        rawPayload: data.rawPayload as object,
      },
    });

    const periodStart = monthlyPeriodStart(data.startedAt);

    await tx.usageCounter.upsert({
      where: {
        tenantId_metric_periodStart: {
          tenantId: data.tenantId,
          metric: "CALLS",
          periodStart,
        },
      },
      create: { tenantId: data.tenantId, metric: "CALLS", periodStart, value: 1 },
      update: { value: { increment: 1 } },
    });

    if (data.durationSec != null && data.durationSec > 0) {
      const minutes = Math.ceil(data.durationSec / 60);
      await tx.usageCounter.upsert({
        where: {
          tenantId_metric_periodStart: {
            tenantId: data.tenantId,
            metric: "CALL_MINUTES",
            periodStart,
          },
        },
        create: { tenantId: data.tenantId, metric: "CALL_MINUTES", periodStart, value: minutes },
        update: { value: { increment: minutes } },
      });
    }

    return event;
  });
}

export async function getUsageCounter(
  tenantId: string,
  metric: MetricType,
  periodStart?: Date
) {
  const ps = periodStart ?? monthlyPeriodStart();
  return prisma.usageCounter.findUnique({
    where: { tenantId_metric_periodStart: { tenantId, metric, periodStart: ps } },
  });
}

export async function getUsageCounters(tenantId: string, periodStart?: Date) {
  const ps = periodStart ?? monthlyPeriodStart();
  return prisma.usageCounter.findMany({
    where: { tenantId, periodStart: ps },
  });
}

export async function getUsageEvents(
  tenantId: string,
  options?: { startDate?: Date; endDate?: Date; limit?: number; offset?: number }
) {
  const where: Record<string, unknown> = { tenantId };
  if (options?.startDate || options?.endDate) {
    const startedAt: Record<string, Date> = {};
    if (options.startDate) startedAt.gte = options.startDate;
    if (options.endDate) startedAt.lte = options.endDate;
    where.startedAt = startedAt;
  }
  return prisma.usageEvent.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
  });
}

export async function usageEventExists(callId: string): Promise<boolean> {
  const row = await prisma.usageEvent.findUnique({
    where: { callId },
    select: { id: true },
  });
  return row !== null;
}

export async function getUsageSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  const events = await prisma.usageEvent.findMany({
    where: {
      tenantId,
      startedAt: { gte: startDate, lte: endDate },
    },
    select: {
      durationSec: true,
      costCents: true,
      startedAt: true,
      agentId: true,
    },
  });

  let totalCalls = 0;
  let totalMinutes = 0;
  let totalCostCents = 0;
  const byDay = new Map<string, { calls: number; minutes: number }>();
  const byAgent = new Map<string, { calls: number; minutes: number }>();

  for (const e of events) {
    totalCalls++;
    const mins = e.durationSec != null ? Math.ceil(e.durationSec / 60) : 0;
    totalMinutes += mins;
    totalCostCents += e.costCents ?? 0;

    const day = e.startedAt.toISOString().slice(0, 10);
    const dayEntry = byDay.get(day) ?? { calls: 0, minutes: 0 };
    dayEntry.calls++;
    dayEntry.minutes += mins;
    byDay.set(day, dayEntry);

    const agentEntry = byAgent.get(e.agentId) ?? { calls: 0, minutes: 0 };
    agentEntry.calls++;
    agentEntry.minutes += mins;
    byAgent.set(e.agentId, agentEntry);
  }

  return {
    totalCalls,
    totalMinutes,
    totalCostCents,
    byDay: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data })),
    byAgent: [...byAgent.entries()]
      .sort((a, b) => b[1].calls - a[1].calls)
      .map(([agentId, data]) => ({ agentId, ...data })),
  };
}
