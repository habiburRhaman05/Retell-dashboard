import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import type {
  AnalyticsSummary,
  RetellCall,
  VoiceAiAnalyticsSummary,
  FullAnalyticsResponse,
} from "@/types/retell";

const MAX_PAGES = 10; // caps a single request at 10,000 calls
const PAGE_SIZE = 1000;

const LATENCY_STAGES: { key: string; label: string }[] = [
  { key: "asr", label: "Speech-to-Text" },
  { key: "llm", label: "LLM Response" },
  { key: "tts", label: "Text-to-Speech" },
  { key: "knowledge_base", label: "Knowledge Base" },
  { key: "llm_websocket_network_rtt", label: "Network RTT" },
  { key: "s2s", label: "Realtime (S2S)" },
];

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function emptyResponse(): FullAnalyticsResponse {
  return {
    callAnalytics: {
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
    },
    voiceAiAnalytics: {
      latencyByStage: [],
      tokenUsage: { avgTokensPerCall: null, totalTokens: 0, sampleCount: 0 },
      cost: { totalCostCents: 0, avgCostCentsPerCall: null, costByDay: [] },
      agentBreakdown: [],
      voiceBreakdown: [],
      modelBreakdown: [],
    },
  };
}

function aggregateCalls(calls: RetellCall[], truncated: boolean): AnalyticsSummary {
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

interface AgentMeta {
  agentName: string;
  voiceId: string | null;
  model: string | null;
}

function aggregateVoiceAi(
  calls: RetellCall[],
  agentMeta: Map<string, AgentMeta>
): VoiceAiAnalyticsSummary {
  const latencySamples = new Map<string, number[]>();
  const tokenValues: number[] = [];
  const costValues: number[] = [];
  const costByDayMap = new Map<string, number>();
  const agentStats = new Map<
    string,
    { agentName: string; total: number; successful: number; analyzed: number; durations: number[] }
  >();
  const voiceCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();

  for (const call of calls) {
    for (const { key } of LATENCY_STAGES) {
      const p50 = call.latency?.[key]?.p50;
      if (typeof p50 === "number") {
        const arr = latencySamples.get(key) ?? [];
        arr.push(p50);
        latencySamples.set(key, arr);
      }
    }

    const tokenAvg = call.llm_token_usage?.average;
    if (typeof tokenAvg === "number") tokenValues.push(tokenAvg);

    const cost = call.call_cost?.combined_cost;
    if (typeof cost === "number") {
      costValues.push(cost);
      if (call.start_timestamp) {
        const day = dayKey(call.start_timestamp);
        costByDayMap.set(day, (costByDayMap.get(day) ?? 0) + cost);
      }
    }

    const meta = agentMeta.get(call.agent_id);
    const agentName = call.agent_name || meta?.agentName || call.agent_id;
    const stats = agentStats.get(call.agent_id) ?? {
      agentName,
      total: 0,
      successful: 0,
      analyzed: 0,
      durations: [],
    };
    stats.total++;
    if (typeof call.call_analysis?.call_successful === "boolean") {
      stats.analyzed++;
      if (call.call_analysis.call_successful) stats.successful++;
    }
    if (typeof call.duration_ms === "number") stats.durations.push(call.duration_ms);
    agentStats.set(call.agent_id, stats);

    if (meta?.voiceId) {
      voiceCounts.set(meta.voiceId, (voiceCounts.get(meta.voiceId) ?? 0) + 1);
    }
    if (meta?.model) {
      modelCounts.set(meta.model, (modelCounts.get(meta.model) ?? 0) + 1);
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const latencyByStage = LATENCY_STAGES.map(({ key, label }) => {
    const samples = latencySamples.get(key) ?? [];
    return { stage: label, avgMs: avg(samples), sampleCount: samples.length };
  }).filter((s) => s.sampleCount > 0);

  const sortedCostDays = [...costByDayMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return {
    latencyByStage,
    tokenUsage: {
      avgTokensPerCall: tokenValues.length
        ? Math.round(tokenValues.reduce((a, b) => a + b, 0) / tokenValues.length)
        : null,
      totalTokens: Math.round(tokenValues.reduce((a, b) => a + b, 0)),
      sampleCount: tokenValues.length,
    },
    cost: {
      totalCostCents: Math.round(costValues.reduce((a, b) => a + b, 0)),
      avgCostCentsPerCall: costValues.length
        ? Math.round((costValues.reduce((a, b) => a + b, 0) / costValues.length) * 100) / 100
        : null,
      costByDay: sortedCostDays.map(([date, costCents]) => ({
        date,
        costCents: Math.round(costCents),
      })),
    },
    agentBreakdown: [...agentStats.entries()]
      .map(([agentId, s]) => ({
        agentId,
        agentName: s.agentName,
        totalCalls: s.total,
        successRate: s.analyzed > 0 ? Math.round((s.successful / s.analyzed) * 1000) / 10 : null,
        avgDurationMs: s.durations.length ? avg(s.durations) : null,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls),
    voiceBreakdown: [...voiceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count })),
    modelBreakdown: [...modelCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count })),
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
      return NextResponse.json(emptyResponse());
    }

    const agentIds = new Set(mappings.map((m) => m.retellAgentId));

    // Build agent_id -> {name, voiceId, model} so calls (which don't carry
    // voice/model directly) can be attributed for the voice/model breakdown.
    const agentMeta = new Map<string, AgentMeta>();
    try {
      const allAgents = await retell.listAgents();
      const llmIdsNeeded = new Set<string>();
      for (const agent of allAgents) {
        if (!agentIds.has(agent.agent_id)) continue;
        agentMeta.set(agent.agent_id, {
          agentName: agent.agent_name || agent.agent_id,
          voiceId: agent.voice_id ?? null,
          model: null,
        });
        if (agent.response_engine?.type === "retell-llm" && agent.response_engine.llm_id) {
          llmIdsNeeded.add(agent.response_engine.llm_id);
        }
      }

      if (llmIdsNeeded.size > 0) {
        const llmModels = await Promise.all(
          [...llmIdsNeeded].map(async (llmId) => {
            try {
              const llm = await retell.getRetellLlm(llmId);
              return [llmId, llm.model] as const;
            } catch {
              return [llmId, null] as const;
            }
          })
        );
        const llmModelMap = new Map(llmModels);
        for (const [agentId, meta] of agentMeta) {
          const agent = allAgents.find((a) => a.agent_id === agentId);
          const llmId =
            agent?.response_engine?.type === "retell-llm" ? agent.response_engine.llm_id : undefined;
          if (llmId) meta.model = llmModelMap.get(llmId) ?? null;
        }
      }
    } catch {
      // Voice/model breakdown is best-effort — call analytics still works
      // without it.
    }

    const agentFilter = [...agentIds].map((id) => ({ agent_id: id }));
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

    const response: FullAnalyticsResponse = {
      callAnalytics: aggregateCalls(calls, truncated),
      voiceAiAnalytics: aggregateVoiceAi(calls, agentMeta),
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
