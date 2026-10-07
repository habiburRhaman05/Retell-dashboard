"use client";

import { useLocation } from "@/providers/location-provider";
import { useAgents } from "@/hooks/use-agents";
import { useKnowledgeBases } from "@/hooks/use-knowledge-bases";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  CheckCircle2,
  FileEdit,
  ArrowRight,
  Volume2,
  BookOpen,
  Plus,
  BarChart3,
  Database,
  Clock,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function OverviewPage() {
  const { locationId } = useLocation();
  const { data: agents, isLoading } = useAgents(locationId);
  const { data: kbs } = useKnowledgeBases(locationId);

  const stats = useMemo(() => {
    if (!agents) return { total: 0, published: 0, drafts: 0 };
    return {
      total: agents.length,
      published: agents.filter((a) => a.is_published).length,
      drafts: agents.filter((a) => !a.is_published).length,
    };
  }, [agents]);

  const recentAgents = useMemo(() => {
    if (!agents) return [];
    return [...agents]
      .sort((a, b) => b.last_modification_timestamp - a.last_modification_timestamp)
      .slice(0, 5);
  }, [agents]);

  const voiceBreakdown = useMemo(() => {
    if (!agents) return [];
    const counts: Record<string, number> = {};
    for (const a of agents) {
      const provider = a.voice_id?.split("-")[0] || "unknown";
      counts[provider] = (counts[provider] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [agents]);

  const kbStats = useMemo(() => {
    if (!kbs) return { total: 0, ready: 0, processing: 0 };
    return {
      total: kbs.length,
      ready: kbs.filter((kb) => kb.status === "complete").length,
      processing: kbs.filter((kb) => kb.status === "in_progress" || kb.status === "refreshing_in_progress").length,
    };
  }, [kbs]);

  const providerColors = [
    "bg-brand-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-pink-500",
  ];

  if (isLoading) {
    return (
      <div className="max-w-none mx-auto px-4 lg:px-6 py-8">
        <div className="h-10 w-64 bg-gray-100 rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse shadow-sm">
              <div className="h-3 w-20 bg-gray-100 rounded mb-4" />
              <div className="h-8 w-14 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 h-72 animate-pulse shadow-sm" />
          <div className="rounded-xl border border-gray-200 bg-white p-5 h-72 animate-pulse shadow-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto px-4 lg:px-6 py-8 animate-fade-in">
      {/* Greeting header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {getGreeting()}
          <span className="text-brand-500">.</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here&apos;s how your voice agents are performing
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Agents"
          value={stats.total}
          icon={Bot}
        />
        <StatCard
          label="Published"
          value={stats.published}
          icon={CheckCircle2}
          trend={stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0}
          trendLabel="of total"
        />
        <StatCard
          label="Drafts"
          value={stats.drafts}
          icon={FileEdit}
        />
        <StatCard
          label="Knowledge Bases"
          value={kbStats.total}
          icon={Database}
          trend={kbStats.total > 0 ? Math.round((kbStats.ready / kbStats.total) * 100) : 0}
          trendLabel="ready"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <Link
          href={`/retell/${locationId}/agents/new`}
          className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-brand-200 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
            <Plus className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Create Agent</p>
            <p className="text-xs text-gray-500">Set up a new voice agent</p>
          </div>
        </Link>
        <Link
          href={`/retell/${locationId}/knowledge-base`}
          className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-brand-200 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Knowledge Base</p>
            <p className="text-xs text-gray-500">Manage agent knowledge</p>
          </div>
        </Link>
        <Link
          href={`/retell/${locationId}/analytics`}
          className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-brand-200 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
            <BarChart3 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Analytics</p>
            <p className="text-xs text-gray-500">View call insights</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recently Modified - spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">
                Recently Modified
              </h2>
            </div>
            <Link
              href={`/retell/${locationId}/agents`}
              className="text-xs text-brand-600 font-medium hover:text-brand-700 inline-flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <div className="divide-y divide-gray-50">
            {recentAgents.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 font-medium">No agents yet</p>
                <p className="text-xs text-gray-400 mt-1">Create or import an agent to get started</p>
              </div>
            ) : (
              recentAgents.map((agent) => (
                <Link
                  key={agent.agent_id}
                  href={`/retell/${locationId}/agents/${agent.agent_id}`}
                  className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-gray-50/70 transition-all duration-150 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                    {(agent.agent_name || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                      {agent.agent_name || "Unnamed Agent"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {agent.voice_id?.replace(/^(retell|cartesia|minimax|11labs|fish_audio|openai|inworld)-/, "")}
                      {agent.language ? ` · ${agent.language}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Badge variant={agent.is_published ? "success" : "warning"} dot>
                      {agent.is_published ? "Live" : "Draft"}
                    </Badge>
                    <span className="text-[11px] text-gray-400 hidden sm:inline whitespace-nowrap">
                      {timeAgo(agent.last_modification_timestamp)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Voice Providers */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800">
                  Voice Providers
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              {voiceBreakdown.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400">No data yet</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {voiceBreakdown.map(([provider, count], idx) => {
                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={provider}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px] font-medium text-gray-700 capitalize">
                            {provider}
                          </span>
                          <span className="text-xs text-gray-400 font-medium">
                            {count} <span className="text-gray-300">({Math.round(pct)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700 ease-out",
                              providerColors[idx % providerColors.length]
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Knowledge Base summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-800">
                  Knowledge Bases
                </h2>
              </div>
              <Link
                href={`/retell/${locationId}/knowledge-base`}
                className="text-xs text-brand-600 font-medium hover:text-brand-700 inline-flex items-center gap-1 transition-colors"
              >
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {kbStats.total === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-gray-400">No knowledge bases</p>
                  <p className="text-xs text-gray-400 mt-1">Add documents for your agents to reference</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900">{kbStats.total}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">{kbStats.ready} Ready</Badge>
                      {kbStats.processing > 0 && (
                        <Badge variant="warning">{kbStats.processing} Processing</Badge>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 rounded-l-full transition-all duration-700"
                      style={{ width: `${kbStats.total > 0 ? (kbStats.ready / kbStats.total) * 100 : 0}%` }}
                    />
                    {kbStats.processing > 0 && (
                      <div
                        className="h-full bg-amber-400 transition-all duration-700"
                        style={{ width: `${(kbStats.processing / kbStats.total) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
