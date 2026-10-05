"use client";

import { useLocation } from "@/providers/location-provider";
import { useAgents } from "@/hooks/use-agents";
import {
  Bot,
  CheckCircle2,
  FileEdit,
  Clock,
  ArrowRight,
  Volume2,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

export default function OverviewPage() {
  const { locationId } = useLocation();
  const { data: agents, isLoading } = useAgents(locationId);

  const stats = useMemo(() => {
    if (!agents) return { total: 0, published: 0, drafts: 0, languages: 0 };
    const langs = new Set(agents.map((a) => a.language).filter(Boolean));
    return {
      total: agents.length,
      published: agents.filter((a) => a.is_published).length,
      drafts: agents.filter((a) => !a.is_published).length,
      languages: langs.size,
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
      .slice(0, 5);
  }, [agents]);

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 w-20 bg-gray-100 rounded mb-3" />
              <div className="h-8 w-12 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-64 animate-pulse" />
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Overview</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Your voice agent performance at a glance
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Total Agents"
          value={stats.total}
          icon={Bot}
          color="cyan"
        />
        <KPICard
          label="Published"
          value={stats.published}
          icon={CheckCircle2}
          color="emerald"
        />
        <KPICard
          label="Drafts"
          value={stats.drafts}
          icon={FileEdit}
          color="amber"
        />
        <KPICard
          label="Languages"
          value={stats.languages}
          icon={Globe}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-gray-800">
              Recently Modified
            </h2>
            <Link
              href={`/retell/${locationId}/agents`}
              className="text-[12px] text-cyan-600 font-medium hover:text-cyan-700 inline-flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentAgents.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-gray-400">
                No agents yet
              </div>
            ) : (
              recentAgents.map((agent) => (
                <Link
                  key={agent.agent_id}
                  href={`/retell/${locationId}/agents/${agent.agent_id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(agent.agent_name || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {agent.agent_name || "Unnamed Agent"}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {agent.voice_id?.replace(/^(retell|cartesia|minimax|11labs|fish_audio|openai|inworld)-/, "")}
                      {agent.language ? ` · ${agent.language}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                        agent.is_published
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          agent.is_published ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                      {agent.is_published ? "Live" : "Draft"}
                    </span>
                    <span className="text-[11px] text-gray-400 hidden sm:inline">
                      {timeAgo(agent.last_modification_timestamp)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-[13px] font-semibold text-gray-800">
              Voice Providers
            </h2>
          </div>
          <div className="p-5">
            {voiceBreakdown.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-gray-400">
                No data yet
              </div>
            ) : (
              <div className="space-y-4">
                {voiceBreakdown.map(([provider, count]) => {
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={provider}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-[13px] font-medium text-gray-700 capitalize">
                            {provider}
                          </span>
                        </div>
                        <span className="text-[12px] text-gray-500">
                          {count} agent{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-[12px] text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              Updated in real-time
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "cyan" | "emerald" | "amber" | "violet";
}) {
  const styles = {
    cyan: "bg-cyan-50 text-cyan-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          {label}
        </span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", styles[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
