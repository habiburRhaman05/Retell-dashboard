import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import type { AnalyticsSummary, RetellCall } from "@/types/retell";

const MAX_PAGES = 10; // caps a single request at 10,000 calls
const PAGE_SIZE = 1000;

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function emptySummary(): AnalyticsSummary {
  return {
    totalCalls: 0,
    avgDurationMs: null,
    avgLatencyMs: null,
    callsByDay: [],
    concurrencyByDay: [],
    callSuccessful: { successful: 0, unsuccessful: 0, pending: 0 },
    disconnectionReason: [],
    userSentiment: [],
    phoneDirection: { inbound: 0, outbound: 0 },
    truncated: false,
  };
}

function aggregate(calls: RetellCall[], truncated: boolean): AnalyticsSummary {
  const callsByDayMap = new Map<string, number>();
  const durations: number[] = [];
  const latencies: number[] = [];
  const successful = { successful: 0, unsuccessful: 0, pending: 0 };
  const disconnectionMap = new Map<string, number>();
  const sentimentMap = new Map<string, number>();
  const phoneDirection = { inbound: 0, outbound: 0 };
  const concurrencyEvents: { t: number; d: 1 | -1 }[] = [];

  for (const call of calls) {
    if (call.start_timestamp) {
      const day = dayKey(call.start_timestamp);
      callsByDayMap.set(day, (callsByDayMap.get(day) ?? 0) + 1);
    }

    if (typeof call.duration_ms === "number") durations.push(call.duration_ms);

    const p50 = call.latency?.e2e?.p50;
    if (typeof p50 === "number") latencies.push(p50);

    const analysis = call.call_analysis;
    if (analysis && typeof analysis.call_successful === "boolean") {
      if (analysis.call_successful) successful.successful++;
      else successful.unsuccessful++;
    } else if (call.call_status === "ended" || call.call_status === "error") {
      successful.pending++;
    }

    if (call.disconnection_reason) {
      disconnectionMap.set(
        call.disconnection_reason,
        (disconnectionMap.get(call.disconnection_reason) ?? 0) + 1
      );
    }

    if (analysis?.user_sentiment) {
      sentimentMap.set(
        analysis.user_sentiment,
        (sentimentMap.get(analysis.user_sentiment) ?? 0) + 1
      );
    }

    if (call.call_type === "phone_call" && call.direction) {
      if (call.direction === "inbound") phoneDirection.inbound++;
      else if (call.direction === "outbound") phoneDirection.outbound++;
    }

    if (call.start_timestamp && call.end_timestamp) {
      concurrencyEvents.push({ t: call.start_timestamp, d: 1 });
      concurrencyEvents.push({ t: call.end_timestamp, d: -1 });
    }
  }

  concurrencyEvents.sort((a, b) => a.t - b.t || a.d - b.d);
  let current = 0;
  const concurrencyByDayMap = new Map<string, number>();
  for (const e of concurrencyEvents) {
    current += e.d;
    const day = dayKey(e.t);
    concurrencyByDayMap.set(day, Math.max(concurrencyByDayMap.get(day) ?? 0, current));
  }

  const sortedDays = (map: Map<string, number>) =>
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b));

  return {
    totalCalls: calls.length,
    avgDurationMs: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null,
    avgLatencyMs: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null,
    callsByDay: sortedDays(callsByDayMap).map(([date, count]) => ({ date, count })),
    concurrencyByDay: sortedDays(concurrencyByDayMap).map(([date, maxConcurrent]) => ({
      date,
      maxConcurrent,
    })),
    callSuccessful: successful,
    disconnectionReason: [...disconnectionMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count })),
    userSentiment: [...sentimentMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sentiment, count]) => ({ sentiment, count })),
    phoneDirection,
    truncated,
  };
}

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");
  const startParam = request.nextUrl.searchParams.get("start");
  const endParam = request.nextUrl.searchParams.get("end");

  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const end = endParam ? Number(endParam) : Date.now();
  const start = startParam ? Number(startParam) : end - 30 * 24 * 60 * 60 * 1000;

  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  try {
    const mappings = await prisma.locationAgent.findMany({
      where: { locationId },
      select: { retellAgentId: true },
    });

    if (mappings.length === 0) {
      return NextResponse.json(emptySummary());
    }

    const agentFilter = mappings.map((m) => ({ agent_id: m.retellAgentId }));
    const calls: RetellCall[] = [];
    let paginationKey: string | undefined;
    let truncated = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await retell.listCalls({
        filter_criteria: {
          agent: agentFilter,
          start_timestamp: { type: "range", op: "bt", value: [start, end] },
        },
        limit: PAGE_SIZE,
        pagination_key: paginationKey,
      });

      calls.push(...res.items);

      if (!res.has_more || !res.pagination_key) {
        paginationKey = undefined;
        break;
      }
      paginationKey = res.pagination_key;
      if (page === MAX_PAGES - 1) truncated = true;
    }

    return NextResponse.json(aggregate(calls, truncated));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
