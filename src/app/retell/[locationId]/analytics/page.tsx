"use client";

import { useState } from "react";
import { useLocation } from "@/providers/location-provider";
import { useAnalytics } from "@/hooks/use-analytics";
import { DateRangePicker, presetRange, type DateRange } from "@/components/analytics/date-range-picker";
import { StatTile } from "@/components/analytics/stat-tile";
import { LineAreaChart } from "@/components/analytics/line-area-chart";
import { DonutChart, type DonutSegment } from "@/components/analytics/donut-chart";
import { Loader2, AlertCircle, PhoneOff, RefreshCw } from "lucide-react";

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
  if (ms === null) return "—";
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

export default function AnalyticsPage() {
  const { locationId } = useLocation();
  const [range, setRange] = useState<DateRange>(() => presetRange(30, "Last 30 days"));

  const { data, isLoading, isFetching, error, refetch } = useAnalytics(
    locationId,
    range.start,
    range.end
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Call performance across this location&apos;s voice agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Updating
            </span>
          )}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 w-24 bg-gray-100 rounded mb-4" />
                <div className="h-24 bg-gray-50 rounded-lg" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-[320px] animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-white rounded-xl border border-red-200 p-10 flex flex-col items-center text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
          <p className="text-sm font-medium text-red-600">Couldn&apos;t load analytics</p>
          <p className="text-[12px] text-gray-500 mt-1 max-w-sm">
            {error instanceof Error ? error.message : "Something went wrong"}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 text-white text-[12px] font-medium hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && data && data.totalCalls === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <PhoneOff className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-[15px] font-semibold text-gray-900">No calls in this range</p>
          <p className="text-[13px] text-gray-500 mt-1 max-w-sm">
            Once your agents start taking calls, call counts, duration, latency and
            sentiment will show up here.
          </p>
        </div>
      )}

      {!isLoading && !error && data && data.totalCalls > 0 && (
        <div className="space-y-4">
          {data.truncated && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              This range has more calls than can be summarized at once — numbers
              below reflect the first 10,000 calls. Narrow the date range for exact
              totals.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile label="Call Counts" value={data.totalCalls.toLocaleString()} />
            <StatTile label="Call Duration" value={formatDuration(data.avgDurationMs)} />
            <StatTile
              label="Call Latency"
              value={data.avgLatencyMs !== null ? `${data.avgLatencyMs}ms` : "—"}
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
              <DonutChart
                segments={buildCallSuccessfulSegments(data.callSuccessful)}
              />
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
      )}
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
