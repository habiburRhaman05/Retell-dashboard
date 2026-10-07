"use client";

import { useState } from "react";
import { useLocation } from "@/providers/location-provider";
import { useAnalytics } from "@/hooks/use-analytics";
import { DateRangePicker, presetRange, type DateRange } from "@/components/analytics/date-range-picker";
import { CallAnalyticsView } from "@/components/analytics/call-analytics-view";
import { VoiceAiAnalyticsView } from "@/components/analytics/voice-ai-analytics-view";
import { Loader2, AlertCircle, PhoneOff, RefreshCw, Phone, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type AnalyticsTab = "call" | "voice-ai";

const TABS: { id: AnalyticsTab; label: string; icon: typeof Phone }[] = [
  { id: "call", label: "Call Analytics", icon: Phone },
  { id: "voice-ai", label: "Voice AI Analytics", icon: Sparkles },
];

export default function AnalyticsPage() {
  const { locationId } = useLocation();
  const [range, setRange] = useState<DateRange>(() => presetRange(30, "Last 30 days"));
  const [tab, setTab] = useState<AnalyticsTab>("call");

  const { data, isLoading, isFetching, error, refetch } = useAnalytics(
    locationId,
    range.start,
    range.end
  );

  return (
    <div className="max-w-none mx-auto px-4 lg:px-6 py-6">
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

      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
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

      {!isLoading && !error && data && data.callAnalytics.totalCalls === 0 && (
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

      {!isLoading && !error && data && data.callAnalytics.totalCalls > 0 && (
        <>
          {tab === "call" && <CallAnalyticsView data={data.callAnalytics} />}
          {tab === "voice-ai" && <VoiceAiAnalyticsView data={data.voiceAiAnalytics} />}
        </>
      )}
    </div>
  );
}
