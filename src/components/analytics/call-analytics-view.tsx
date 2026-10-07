"use client";

import { StatTile } from "./stat-tile";
import { LineAreaChart } from "./line-area-chart";
import { DonutChart, type DonutSegment } from "./donut-chart";
import { AlertCircle } from "lucide-react";
import type { AnalyticsSummary } from "@/types/retell";

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
const STATUS = {
  good: "#0ca30c",
  critical: "#d03b3b",
  muted: "#898781",
  mutedLight: "#c3c2b7",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatReason(reason: string): string {
  return reason.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function CallAnalyticsView({ data }: { data: AnalyticsSummary }) {
  return (
    <div className="space-y-4">
      {data.truncated && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          This range has more calls than can be summarized at once - numbers
          below reflect the first 10,000 calls. Narrow the date range for exact
          totals.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Call Counts" value={data.totalCalls.toLocaleString()} />
        <StatTile label="Call Duration" value={formatDuration(data.avgDurationMs)} />
        <StatTile
          label="Call Latency"
          value={data.avgLatencyMs !== null ? `${data.avgLatencyMs}ms` : "-"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-4">Call Counts</h2>
          <LineAreaChart
            data={data.callsByDay.map((d) => ({ date: d.date, value: d.count }))}
            color={CATEGORICAL[0]}
            seriesLabel="Call counts"
            formatValue={(v) => `${v} call${v !== 1 ? "s" : ""}`}
            integersOnly
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-4">Concurrency Used</h2>
          <LineAreaChart
            data={data.concurrencyByDay.map((d) => ({ date: d.date, value: d.maxConcurrent }))}
            color={CATEGORICAL[0]}
            seriesLabel="Concurrency used"
            formatValue={(v) => `${v} concurrent`}
            integersOnly
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ChartCard title="Call Successful">
          <DonutChart segments={buildCallSuccessfulSegments(data.callSuccessful)} />
        </ChartCard>
        <ChartCard title="Disconnection Reason">
          <DonutChart segments={buildReasonSegments(data.disconnectionReason)} />
        </ChartCard>
        <ChartCard title="User Sentiment">
          <DonutChart segments={buildSentimentSegments(data.userSentiment)} />
        </ChartCard>
        <ChartCard title="Phone Inbound / Outbound">
          <DonutChart
            segments={[
              { label: "Inbound", value: data.phoneDirection.inbound, color: CATEGORICAL[0] },
              { label: "Outbound", value: data.phoneDirection.outbound, color: CATEGORICAL[2] },
            ]}
            emptyMessage="No phone calls in this range"
          />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-[13px] font-semibold text-gray-800 mb-1">{title}</h2>
      {children}
    </div>
  );
}

function buildCallSuccessfulSegments(c: {
  successful: number;
  unsuccessful: number;
  pending: number;
}): DonutSegment[] {
  const segments: DonutSegment[] = [
    { label: "Successful", value: c.successful, color: STATUS.good },
    { label: "Unsuccessful", value: c.unsuccessful, color: STATUS.critical },
  ];
  if (c.pending > 0) segments.push({ label: "Pending analysis", value: c.pending, color: STATUS.mutedLight });
  return segments;
}

function buildSentimentSegments(data: { sentiment: string; count: number }[]): DonutSegment[] {
  const colorFor = (s: string) =>
    s === "Positive" ? STATUS.good : s === "Negative" ? STATUS.critical : s === "Neutral" ? STATUS.muted : STATUS.mutedLight;
  return data.map((d) => ({ label: d.sentiment, value: d.count, color: colorFor(d.sentiment) }));
}

function buildReasonSegments(data: { reason: string; count: number }[]): DonutSegment[] {
  const top = data.slice(0, 7);
  const rest = data.slice(7);
  const segments: DonutSegment[] = top.map((d, i) => ({
    label: formatReason(d.reason),
    value: d.count,
    color: CATEGORICAL[i % CATEGORICAL.length],
  }));
  if (rest.length > 0) {
    segments.push({
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, r) => sum + r.count, 0),
      color: STATUS.mutedLight,
    });
  }
  return segments;
}
