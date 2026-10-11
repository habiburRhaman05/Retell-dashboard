"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  PhoneCall,
  Plus,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import { useLocation } from "@/providers/location-provider";
import { useAgents } from "@/hooks/use-agents";
import { useKnowledgeBases } from "@/hooks/use-knowledge-bases";
import { useAnalytics } from "@/hooks/use-analytics";
import { presetRange } from "@/components/analytics/date-range-picker";
import { LineAreaChart } from "@/components/analytics/line-area-chart";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo } from "@/lib/utils";
import { languagesLabel } from "@/lib/languages";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "0:00";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-cyan-600",
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

type Tone = "blue" | "violet" | "emerald" | "amber";

const TONES: Record<Tone, { tile: string; glow: string; spark: string }> = {
  blue: { tile: "bg-blue-100 text-blue-600", glow: "from-blue-50", spark: "#2563eb" },
  violet: { tile: "bg-violet-100 text-violet-600", glow: "from-violet-50", spark: "#7c3aed" },
  emerald: { tile: "bg-emerald-100 text-emerald-600", glow: "from-emerald-50", spark: "#059669" },
  amber: { tile: "bg-amber-100 text-amber-600", glow: "from-amber-50", spark: "#d97706" },
};

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2 || Math.max(...values) === 0) return null;
  const w = 96;
  const h = 32;
  const max = Math.max(...values);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 8)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-8" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
  spark,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  loading?: boolean;
  spark?: number[];
}) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br to-white p-5 shadow-sm transition-all hover:shadow-md",
        t.glow
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center", t.tile)}>
          <Icon className="w-5 h-5" />
        </span>
        {spark && <Sparkline values={spark} color={t.spark} />}
      </div>
      <p className="mt-4 text-[12px] font-medium text-gray-500">{label}</p>
      {loading ? (
        <div className="h-8 w-20 rounded-md bg-gray-200/70 animate-pulse mt-1" />
      ) : (
        <p className="text-[28px] leading-tight font-bold text-gray-900 tracking-tight">{value}</p>
      )}
      {hint && <p className="text-[12px] text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-brand-500" />}
          <h2 className="text-[14px] font-semibold text-gray-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function OverviewPage() {
  const { locationId } = useLocation();
  const { data: agents, isLoading: agentsLoading } = useAgents(locationId);
  const { data: kbs, isLoading: kbsLoading } = useKnowledgeBases(locationId);
  const [range] = useState(() => presetRange(30, "Last 30 days"));
  const analytics = useAnalytics(locationId, range.start, range.end);

  const calls = analytics.data?.callAnalytics;
  const successRate = useMemo(() => {
    if (!calls) return null;
    const { successful, unsuccessful } = calls.callSuccessful;
    const judged = successful + unsuccessful;
    return judged > 0 ? Math.round((successful / judged) * 100) : null;
  }, [calls]);

  const agentStats = useMemo(() => {
    const list = agents ?? [];
    return {
      total: list.length,
      voice: list.filter((a) => a.channel !== "chat").length,
      text: list.filter((a) => a.channel === "chat").length,
      published: list.filter((a) => a.is_published).length,
    };
  }, [agents]);

  const recentAgents = useMemo(
    () =>
      [...(agents ?? [])]
        .sort((a, b) => b.last_modification_timestamp - a.last_modification_timestamp)
        .slice(0, 5),
    [agents]
  );

  const kbStats = useMemo(() => {
    const list = kbs ?? [];
    return {
      total: list.length,
      ready: list.filter((k) => k.status === "complete").length,
      processing: list.filter((k) => k.status === "in_progress" || k.status === "refreshing_in_progress").length,
      failed: list.filter((k) => k.status === "error").length,
    };
  }, [kbs]);

  const callSeries = calls?.callsByDay ?? [];
  const showChecklist = !agentsLoading && !kbsLoading && (agentStats.total === 0 || kbStats.total === 0 || (calls?.totalCalls ?? 0) === 0);

  const base = `/retell/${locationId}`;

  const quickActions = [
    { href: `${base}/agents/new`, title: "Create agent", sub: "Voice or text", icon: Plus, tone: "bg-blue-100 text-blue-600" },
    { href: `${base}/knowledge-base`, title: "Knowledge base", sub: "Add what agents know", icon: BookOpen, tone: "bg-emerald-100 text-emerald-600" },
    { href: `${base}/analytics`, title: "Analytics", sub: "Calls, cost and quality", icon: BarChart3, tone: "bg-violet-100 text-violet-600" },
  ];

  return (
    <div className="max-w-none mx-auto px-4 lg:px-6 py-6 space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-600 px-6 py-7 sm:px-8 sm:py-9 text-white shadow-lg shadow-brand-600/20">
        <div className="pointer-events-none absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10 blur-sm" />
        <div className="pointer-events-none absolute right-24 -bottom-28 w-64 h-64 rounded-full bg-indigo-300/20" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Your AI agents at a glance
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{getGreeting()}</h1>
            <p className="mt-2 text-[14px] text-white/80 leading-relaxed">
              {agentsLoading
                ? "Loading your workspace..."
                : agentStats.total === 0
                ? "Create your first agent to start taking calls and chats."
                : `${agentStats.total} agent${agentStats.total !== 1 ? "s" : ""} ready${
                    calls ? `, ${calls.totalCalls.toLocaleString()} call${calls.totalCalls !== 1 ? "s" : ""} in the last 30 days` : ""
                  }.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`${base}/agents/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-brand-700 shadow-sm hover:bg-white/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create agent
            </Link>
            <Link
              href={`${base}/analytics`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              View analytics
            </Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Agents"
          value={String(agentStats.total)}
          hint={`${agentStats.voice} voice, ${agentStats.text} text`}
          icon={Bot}
          tone="blue"
          loading={agentsLoading}
        />
        <KpiCard
          label="Calls, last 30 days"
          value={calls ? calls.totalCalls.toLocaleString() : "-"}
          hint={calls ? `${calls.phoneDirection.inbound} inbound, ${calls.phoneDirection.outbound} outbound` : undefined}
          icon={PhoneCall}
          tone="violet"
          loading={analytics.isLoading}
          spark={callSeries.map((d) => d.count)}
        />
        <KpiCard
          label="Success rate"
          value={successRate === null ? "-" : `${successRate}%`}
          hint={calls ? `${calls.callSuccessful.successful} successful calls` : undefined}
          icon={Target}
          tone="emerald"
          loading={analytics.isLoading}
        />
        <KpiCard
          label="Average call length"
          value={calls ? formatDuration(calls.avgDurationMs) : "-"}
          hint="minutes:seconds"
          icon={Timer}
          tone="amber"
          loading={analytics.isLoading}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Panel
            title="Call volume"
            icon={PhoneCall}
            action={
              <Link href={`${base}/analytics`} className="text-[12px] font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
                Details <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            <div className="p-5">
              {analytics.isLoading ? (
                <div className="h-[260px] rounded-xl bg-gray-50 animate-pulse" />
              ) : analytics.error ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-center">
                  <AlertCircle className="w-7 h-7 text-red-400 mb-2" />
                  <p className="text-sm font-medium text-red-600">Could not load call data</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">
                    {analytics.error instanceof Error ? analytics.error.message : "Something went wrong"}
                  </p>
                  <button
                    onClick={() => analytics.refetch()}
                    className="mt-3 text-[12px] font-medium text-brand-600 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : calls && calls.totalCalls === 0 ? (
                <div className="h-[170px] flex flex-col items-center justify-center text-center">
                  <span className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-500 flex items-center justify-center mb-3">
                    <PhoneCall className="w-6 h-6" />
                  </span>
                  <p className="text-sm font-medium text-gray-700">No calls in the last 30 days</p>
                  <p className="text-xs text-gray-500 mt-1">Open an agent and press Test Call to try one.</p>
                </div>
              ) : (
                <LineAreaChart
                  data={callSeries.map((d) => ({ date: d.date, value: d.count }))}
                  color="#2563eb"
                  seriesLabel="Calls"
                  formatValue={(v) => `${v} call${v !== 1 ? "s" : ""}`}
                  integersOnly
                  emptyMessage="No calls in the last 30 days"
                />
              )}
            </div>
          </Panel>

          <Panel
            title="Recently updated agents"
            icon={Clock}
            action={
              <Link href={`${base}/agents`} className="text-[12px] font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            {agentsLoading ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-gray-50 animate-pulse" />
                ))}
              </div>
            ) : recentAgents.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No agents yet</p>
                <p className="text-xs text-gray-500 mt-1">Create or import an agent to get started</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentAgents.map((agent) => (
                  <li key={agent.agent_id}>
                    <Link
                      href={`${base}/agents/${agent.agent_id}`}
                      className="group flex items-center gap-3.5 px-5 py-3.5 hover:bg-gray-50/70 transition-colors"
                    >
                      <span
                        className={cn(
                          "w-10 h-10 rounded-xl bg-gradient-to-br text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-sm",
                          gradientFor(agent.agent_id)
                        )}
                      >
                        {(agent.agent_name || "U")[0].toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                          {agent.agent_name || "Unnamed Agent"}
                        </p>
                        <p className="text-[12px] text-gray-500 truncate">
                          {agent.channel === "chat" ? "Text agent" : "Voice agent"}
                          {agent.language ? ` · ${languagesLabel(agent.language)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {agent.channel === "chat" && <Badge variant="info">Text</Badge>}
                        <Badge variant={agent.is_published ? "success" : "warning"} dot>
                          {agent.is_published ? "Live" : "Draft"}
                        </Badge>
                        <span className="text-[11px] text-gray-400 hidden sm:inline whitespace-nowrap">
                          {timeAgo(agent.last_modification_timestamp)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Panel title="Quick actions">
            <div className="p-3 space-y-1">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.title}
                    href={a.href}
                    className="group flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center", a.tone)}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                      <p className="text-[12px] text-gray-500">{a.sub}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel title="Your agents" icon={MessageSquare}>
            <div className="p-5 space-y-4">
              {agentStats.total === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No agents yet</p>
              ) : (
                <>
                  <MixBar
                    label="By channel"
                    parts={[
                      { label: "Voice", value: agentStats.voice, color: "bg-blue-500" },
                      { label: "Text", value: agentStats.text, color: "bg-violet-500" },
                    ]}
                  />
                  <MixBar
                    label="By status"
                    parts={[
                      { label: "Live", value: agentStats.published, color: "bg-emerald-500" },
                      { label: "Draft", value: agentStats.total - agentStats.published, color: "bg-amber-400" },
                    ]}
                  />
                </>
              )}
            </div>
          </Panel>

          <Panel
            title="Knowledge bases"
            icon={BookOpen}
            action={
              <Link href={`${base}/knowledge-base`} className="text-[12px] font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            <div className="p-5">
              {kbsLoading ? (
                <div className="h-16 rounded-xl bg-gray-50 animate-pulse" />
              ) : kbStats.total === 0 ? (
                <div className="text-center py-3">
                  <p className="text-sm text-gray-500">No knowledge bases yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add documents for your agents to answer from</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold text-gray-900 leading-none">{kbStats.total}</span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Badge variant="success">{kbStats.ready} ready</Badge>
                      {kbStats.processing > 0 && <Badge variant="warning">{kbStats.processing} processing</Badge>}
                      {kbStats.failed > 0 && <Badge variant="error">{kbStats.failed} failed</Badge>}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(kbStats.ready / kbStats.total) * 100}%` }} />
                    <div className="h-full bg-amber-400 transition-all duration-700" style={{ width: `${(kbStats.processing / kbStats.total) * 100}%` }} />
                    <div className="h-full bg-red-400 transition-all duration-700" style={{ width: `${(kbStats.failed / kbStats.total) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {showChecklist && (
            <Panel title="Getting started" icon={Sparkles}>
              <ul className="p-3 space-y-0.5">
                {[
                  { done: agentStats.total > 0, label: "Create an agent", href: `${base}/agents/new` },
                  { done: kbStats.total > 0, label: "Add a knowledge base", href: `${base}/knowledge-base` },
                  { done: (calls?.totalCalls ?? 0) > 0, label: "Take your first call", href: `${base}/agents` },
                ].map((s) => (
                  <li key={s.label}>
                    <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-gray-50 transition-colors">
                      {s.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300 shrink-0" />
                      )}
                      <span className={cn("text-sm", s.done ? "text-gray-400 line-through" : "text-gray-800 font-medium")}>
                        {s.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function MixBar({
  label,
  parts,
}: {
  label: string;
  parts: { label: string; value: number; color: string }[];
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <p className="text-[12px] font-medium text-gray-500 mb-2">{label}</p>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
        {parts.map((p) => (
          <div
            key={p.label}
            className={cn("h-full transition-all duration-700", p.color)}
            style={{ width: `${total ? (p.value / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-[12px] text-gray-600">
            <span className={cn("w-2 h-2 rounded-full", p.color)} />
            {p.label} <span className="font-semibold text-gray-900">{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
