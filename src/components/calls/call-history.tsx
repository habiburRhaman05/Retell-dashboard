"use client";

import { useEffect, useMemo, useState } from "react";
import {
  History,
  Settings2,
  EyeOff,
  ChevronDown,
  Download,
  Filter as FilterIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DateRangePicker,
  presetRange,
  type DateRange,
} from "@/components/analytics/date-range-picker";
import { useCallHistory, type CallHistoryFilters } from "@/hooks/use-calls";
import { useToast } from "@/components/layout/toast";
import type { RetellCall } from "@/types/retell";
import { CallDetailDrawer } from "./call-detail-drawer";

interface ColumnDef {
  key: string;
  label: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "time", label: "Time" },
  { key: "duration", label: "Duration" },
  { key: "channelType", label: "Channel Type" },
  { key: "cost", label: "Cost" },
  { key: "sessionId", label: "Session ID" },
  { key: "endReason", label: "End Reason" },
  { key: "sessionStatus", label: "Session Status" },
  { key: "userSentiment", label: "User Sentiment" },
  { key: "from", label: "From" },
  { key: "to", label: "To" },
  { key: "direction", label: "Direction" },
  { key: "sessionOutcome", label: "Session Outcome" },
  { key: "latency", label: "End to End Latency" },
];

const COLUMN_STORAGE_KEY = "call-history-columns";

function loadVisibleColumns(): Set<string> {
  const all = new Set(COLUMNS.map((c) => c.key));
  if (typeof window === "undefined") return all;
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return all;
    const saved: unknown = JSON.parse(raw);
    if (Array.isArray(saved) && saved.every((v) => typeof v === "string")) {
      return new Set(saved.filter((k) => all.has(k)));
    }
  } catch {
    // corrupt/blocked storage - fall back to showing everything
  }
  return all;
}

function formatTime(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(ms?: number): string {
  if (ms == null) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCost(cents?: number): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(3)}`;
}

function formatLatency(call: RetellCall): string {
  const p50 = call.latency?.e2e?.p50;
  return p50 == null ? "—" : `${Math.round(p50)}ms`;
}

const RESOURCE_DISCONNECT_REASONS = new Set([
  "credit_exhausted", "no_valid_payment", "budget_reached", "concurrency_limit_reached",
  "no_concurrency_fallback", "scam_detected",
]);
const ERROR_DISCONNECT_PREFIX = "error_";

function endReasonVariant(reason?: string): "success" | "error" | "warning" | "neutral" {
  if (!reason) return "neutral";
  if (reason.startsWith(ERROR_DISCONNECT_PREFIX) || RESOURCE_DISCONNECT_REASONS.has(reason)) return "error";
  if (reason === "user_hangup" || reason === "agent_hangup") return "success";
  return "neutral";
}

function statusVariant(status: string): "success" | "error" | "warning" | "info" | "neutral" {
  if (status === "error") return "error";
  if (status === "ongoing" || status === "registered") return "info";
  if (status === "not_connected") return "warning";
  return "neutral";
}

function sentimentVariant(sentiment?: string): "success" | "error" | "info" | "neutral" {
  if (sentiment === "Positive") return "success";
  if (sentiment === "Negative") return "error";
  if (sentiment === "Neutral") return "info";
  return "neutral";
}

function outcomeLabel(call: RetellCall): { text: string; variant: "success" | "error" | "neutral" } {
  const successful = call.call_analysis?.call_successful;
  if (successful === true) return { text: "Successful", variant: "success" };
  if (successful === false) return { text: "Unsuccessful", variant: "error" };
  return { text: "Pending", variant: "neutral" };
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function CallHistory() {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetRange(30, "Last 30 days"));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("");
  const [disconnectFilter, setDisconnectFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => loadVisibleColumns());
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...visibleColumns]));
    } catch {
      // best effort - column prefs are a convenience, not critical state
    }
  }, [visibleColumns]);

  const filters: CallHistoryFilters = useMemo(
    () => ({
      start: dateRange.start,
      end: dateRange.end,
      page,
      pageSize,
      status: statusFilter || undefined,
      direction: directionFilter || undefined,
      sentiment: sentimentFilter || undefined,
      disconnectionReason: disconnectFilter || undefined,
    }),
    [dateRange, page, pageSize, statusFilter, directionFilter, sentimentFilter, disconnectFilter]
  );

  const { data, isLoading, error, refetch } = useCallHistory(filters);
  const items = data?.items ?? [];
  const totalPages = data?.total != null ? Math.max(1, Math.ceil(data.total / pageSize)) : null;

  const resetPage = () => setPage(1);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRow = (callId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((c) => c.call_id)));
  };

  const exportRows = (which: "page" | "selected") => {
    const rows = which === "selected" ? items.filter((c) => selected.has(c.call_id)) : items;
    if (rows.length === 0) {
      toast("Nothing to export", "error");
      return;
    }
    const columns = COLUMNS.filter((c) => visibleColumns.has(c.key));
    const header = columns.map((c) => c.label);
    const body = rows.map((call) => columns.map((c) => cellText(call, c.key)));
    downloadCsv(`call-history-${Date.now()}.csv`, [header, ...body]);
    toast(`Exported ${rows.length} call${rows.length === 1 ? "" : "s"}`, "success");
    setShowActions(false);
  };

  const anyFilterActive = !!(statusFilter || directionFilter || sentimentFilter || disconnectFilter);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            Call History
          </h2>
          {selected.size > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{selected.size} selected</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100">
        <DateRangePicker
          value={dateRange}
          onChange={(r) => {
            setDateRange(r);
            resetPage();
          }}
        />

        <div className="relative">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-[13px] font-medium transition-colors",
              anyFilterActive
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            )}
          >
            <FilterIcon className="w-3.5 h-3.5 text-gray-400" />
            Filter
            {anyFilterActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            )}
          </button>
          {showFilters && (
            <div className="absolute left-0 top-full mt-1.5 w-72 rounded-lg border border-gray-200 bg-white shadow-lg z-20 p-4 space-y-3">
              <FilterSelect
                label="Session Status"
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); resetPage(); }}
                options={["registered", "not_connected", "ongoing", "ended", "error"]}
              />
              <FilterSelect
                label="Direction"
                value={directionFilter}
                onChange={(v) => { setDirectionFilter(v); resetPage(); }}
                options={["inbound", "outbound"]}
              />
              <FilterSelect
                label="User Sentiment"
                value={sentimentFilter}
                onChange={(v) => { setSentimentFilter(v); resetPage(); }}
                options={["Positive", "Neutral", "Negative", "Unknown"]}
              />
              <FilterSelect
                label="End Reason"
                value={disconnectFilter}
                onChange={(v) => { setDisconnectFilter(v); resetPage(); }}
                options={["user_hangup", "agent_hangup", "call_transfer", "voicemail_reached", "inactivity", "credit_exhausted", "dial_no_answer", "dial_busy"]}
              />
              <button
                onClick={() => {
                  setStatusFilter(""); setDirectionFilter(""); setSentimentFilter(""); setDisconnectFilter("");
                  resetPage();
                }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700 pt-1"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowColumnSettings((v) => !v)}
              aria-label="Column settings"
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            {showColumnSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-20 p-2 max-h-72 overflow-y-auto">
                {COLUMNS.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-gray-700 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(c.key)}
                      onChange={() => toggleColumn(c.key)}
                      className="rounded border-gray-300"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowActions((v) => !v)}
            >
              Actions
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-20 py-1">
                <button
                  onClick={() => exportRows("page")}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-3.5 h-3.5 text-gray-400" />
                  Export this page
                </button>
                <button
                  onClick={() => exportRows("selected")}
                  disabled={selected.size === 0}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5 text-gray-400" />
                  Export selected ({selected.size})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading call history...</span>
        </div>
      )}

      {error && (
        <div className="p-8 text-center">
          <p className="text-sm text-red-600 font-medium">Failed to load call history</p>
          <p className="text-xs text-gray-500 mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <EyeOff className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-900">No calls in this range</p>
          <p className="text-xs text-gray-500 mt-1">
            {anyFilterActive ? "Try clearing your filters" : "Calls will show up here once your agents start taking them"}
          </p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                {COLUMNS.filter((c) => visibleColumns.has(c.key)).map((c) => (
                  <th key={c.key} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((call) => (
                <CallRow
                  key={call.call_id}
                  call={call}
                  visibleColumns={visibleColumns}
                  selected={selected.has(call.call_id)}
                  onToggle={() => toggleRow(call.call_id)}
                  onOpen={() => setActiveCallId(call.call_id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
            className="px-2 py-1 rounded-md border border-gray-200 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Page {page}{totalPages ? ` of ${totalPages}` : ""}
            {data?.total != null && ` · Total Session: ${data.total}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.hasMore}
              className="px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {activeCallId && (
        <CallDetailDrawer callId={activeCallId} onClose={() => setActiveCallId(null)} />
      )}
    </div>
  );
}

function cellText(call: RetellCall, key: string): string {
  switch (key) {
    case "time": return formatTime(call.start_timestamp);
    case "duration": return formatDuration(call.duration_ms);
    case "channelType": return call.call_type;
    case "cost": return formatCost(call.call_cost?.combined_cost);
    case "sessionId": return call.call_id;
    case "endReason": return call.disconnection_reason ?? "";
    case "sessionStatus": return call.call_status;
    case "userSentiment": return call.call_analysis?.user_sentiment ?? "Unknown";
    case "from": return call.from_number ?? "";
    case "to": return call.to_number ?? "";
    case "direction": return call.direction ?? "";
    case "sessionOutcome": return outcomeLabel(call).text;
    case "latency": return formatLatency(call);
    default: return "";
  }
}

function CallRow({
  call,
  visibleColumns,
  selected,
  onToggle,
  onOpen,
}: {
  call: RetellCall;
  visibleColumns: Set<string>;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const outcome = outcomeLabel(call);
  const cell = (key: string) => {
    switch (key) {
      case "time":
        return <span className="text-gray-700 whitespace-nowrap">{formatTime(call.start_timestamp)}</span>;
      case "duration":
        return <span className="text-gray-700 font-mono">{formatDuration(call.duration_ms)}</span>;
      case "channelType":
        return <span className="text-gray-500">{call.call_type}</span>;
      case "cost":
        return <span className="text-gray-700">{formatCost(call.call_cost?.combined_cost)}</span>;
      case "sessionId":
        return <span className="text-gray-500 font-mono text-[11px]">{call.call_id}</span>;
      case "endReason":
        return call.disconnection_reason
          ? <Badge variant={endReasonVariant(call.disconnection_reason)} dot>{call.disconnection_reason}</Badge>
          : <span className="text-gray-300">—</span>;
      case "sessionStatus":
        return <Badge variant={statusVariant(call.call_status)} dot>{call.call_status}</Badge>;
      case "userSentiment": {
        const sentiment = call.call_analysis?.user_sentiment ?? "Unknown";
        return <Badge variant={sentimentVariant(sentiment)} dot>{sentiment}</Badge>;
      }
      case "from":
        return <span className="text-gray-500 font-mono text-[11px]">{call.from_number ?? "—"}</span>;
      case "to":
        return <span className="text-gray-500 font-mono text-[11px]">{call.to_number ?? "—"}</span>;
      case "direction":
        return <span className="text-gray-500 capitalize">{call.direction ?? "—"}</span>;
      case "sessionOutcome":
        return <Badge variant={outcome.variant} dot>{outcome.text}</Badge>;
      case "latency":
        return <span className="text-gray-500">{formatLatency(call)}</span>;
      default:
        return null;
    }
  };

  return (
    <tr
      className={cn(
        "border-b border-gray-50 transition-colors cursor-pointer",
        selected ? "bg-brand-50/40" : "hover:bg-gray-50/50"
      )}
      onClick={onOpen}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} className="rounded border-gray-300" />
      </td>
      {COLUMNS.filter((c) => visibleColumns.has(c.key)).map((c) => (
        <td key={c.key} className="px-4 py-3 text-[13px] whitespace-nowrap">
          {cell(c.key)}
        </td>
      ))}
    </tr>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[13px] text-gray-700"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
