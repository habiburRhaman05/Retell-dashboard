"use client";

import { StatTile } from "./stat-tile";
import { LineAreaChart } from "./line-area-chart";
import { DonutChart, type DonutSegment } from "./donut-chart";
import { BarList, type BarListItem } from "./bar-list";
import type { VoiceAiAnalyticsSummary } from "@/types/retell";

const CATEGORICAL = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function successBadge(rate: number | null): BarListItem["badge"] {
  if (rate === null) return undefined;
  return {
    text: `${rate}% success`,
    tone: rate >= 80 ? "good" : rate >= 50 ? "warning" : "critical",
  };
}

function toSegments(items: { label: string; count: number }[]): DonutSegment[] {
  const top = items.slice(0, 7);
  const rest = items.slice(7);
  const segments: DonutSegment[] = top.map((item, i) => ({
    label: item.label,
    value: item.count,
    color: CATEGORICAL[i % CATEGORICAL.length],
  }));
  if (rest.length > 0) {
    segments.push({
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, r) => sum + r.count, 0),
      color: "#c3c2b7",
    });
  }
  return segments;
}

export function VoiceAiAnalyticsView({ data }: { data: VoiceAiAnalyticsSummary }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Avg Tokens / Call"
          value={data.tokenUsage.avgTokensPerCall?.toLocaleString() ?? "-"}
        />
        <StatTile label="Total Cost" value={formatCents(data.cost.totalCostCents)} />
        <StatTile
          label="Avg Cost / Call"
          value={data.cost.avgCostCentsPerCall !== null ? formatCents(data.cost.avgCostCentsPerCall) : "-"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-1">AI Pipeline Latency</h2>
          <p className="text-[11px] text-gray-400 mb-4">
            Average time spent in each stage of the voice pipeline (p50, ms)
          </p>
          <BarList
            items={data.latencyByStage.map((s) => ({ label: s.stage, value: s.avgMs }))}
            color={CATEGORICAL[0]}
            formatValue={(v) => `${v}ms`}
            emptyMessage="No latency data for this range"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-1">Per-Agent Comparison</h2>
          <p className="text-[11px] text-gray-400 mb-4">
            Call volume and success rate by agent
          </p>
          <BarList
            items={data.agentBreakdown.map((a) => ({
              label: a.agentName,
              value: a.totalCalls,
              badge: successBadge(a.successRate),
            }))}
            color={CATEGORICAL[2]}
            formatValue={(v) => `${v} call${v !== 1 ? "s" : ""}`}
            emptyMessage="No agent activity for this range"
          />
        </div>
      </div>

      {data.cost.costByDay.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-4">Cost Over Time</h2>
          <LineAreaChart
            data={data.cost.costByDay.map((d) => ({ date: d.date, value: d.costCents / 100 }))}
            color={CATEGORICAL[1]}
            seriesLabel="Cost"
            formatValue={(v) => `$${v.toFixed(2)}`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-1">Voice Usage</h2>
          <p className="text-[11px] text-gray-400 mb-2">Calls by TTS voice (current agent config)</p>
          <DonutChart
            segments={toSegments(data.voiceBreakdown)}
            emptyMessage="No voice data available"
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-1">Model Usage</h2>
          <p className="text-[11px] text-gray-400 mb-2">Calls by LLM model (current agent config)</p>
          <DonutChart
            segments={toSegments(data.modelBreakdown)}
            emptyMessage="No model data available"
          />
        </div>
      </div>
    </div>
  );
}
