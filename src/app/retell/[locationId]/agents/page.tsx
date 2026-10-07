"use client";

import { useLocation } from "@/providers/location-provider";
import {
  useAgents,
  useDeleteAgent,
  useAvailableAgents,
  useImportAgents,
} from "@/hooks/use-agents";
import { useToast } from "@/components/layout/toast";
import { AgentCard } from "@/components/agents/agent-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  List,
  ArrowUpDown,
  Plus,
  Download,
  X,
  Check,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { RetellAgent } from "@/types/retell";

function getVoiceLabel(agent: RetellAgent): string {
  const vid = agent.voice_id || "";
  return vid.replace(/^(11labs|cartesia|retell|fish_audio|minimax|openai|inworld)-/i, "");
}

function ImportModal({
  locationId,
  onClose,
}: {
  locationId: string;
  onClose: () => void;
}) {
  const { data: available, isLoading } = useAvailableAgents(locationId, true);
  const importAgents = useImportAgents(locationId);
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!available) return [];
    if (!search) return available;
    return available.filter(
      (a) =>
        (a.agent_name || "").toLowerCase().includes(search.toLowerCase()) ||
        a.agent_id.toLowerCase().includes(search.toLowerCase())
    );
  }, [available, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!filtered) return;
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.agent_id)));
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    try {
      const result = await importAgents.mutateAsync([...selected]);
      toast(`Imported ${result.imported} agent${result.imported !== 1 ? "s" : ""}`, "success");
      onClose();
    } catch {
      toast("Failed to import agents", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4 animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Import Agents</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select agents from your Retell account to add to this location
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <SearchInput
            placeholder="Search available agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-gray-500">Loading agents...</span>
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">
                {search
                  ? "No matching agents found"
                  : "No unassigned agents available"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                All agents are already assigned to a location
              </p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={selectAll}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  {selected.size === filtered.length ? "Deselect all" : "Select all"}
                </button>
                <span className="text-xs text-gray-400">
                  {filtered.length} available
                </span>
              </div>
              <div className="space-y-2">
                {filtered.map((agent) => (
                  <button
                    key={agent.agent_id}
                    onClick={() => toggleSelect(agent.agent_id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-150 text-left",
                      selected.has(agent.agent_id)
                        ? "border-brand-400 bg-brand-50/50 ring-1 ring-brand-500/20 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-150",
                        selected.has(agent.agent_id)
                          ? "bg-brand-500 border-brand-500"
                          : "border-gray-300"
                      )}
                    >
                      {selected.has(agent.agent_id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {agent.agent_name || "Unnamed Agent"}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400 font-mono">
                          {agent.agent_id.slice(0, 16)}...
                        </span>
                        <span className="text-xs text-gray-500">
                          Voice: {getVoiceLabel(agent)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {agent.language || "en-US"}
                        </span>
                      </div>
                    </div>
                    <Badge variant={agent.is_published ? "success" : "warning"}>
                      {agent.is_published ? "Published" : "Draft"}
                    </Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <span className="text-xs text-gray-500">
            {selected.size} agent{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleImport}
              disabled={selected.size === 0}
              loading={importAgents.isPending}
              icon={Download}
            >
              Import Selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { locationId } = useLocation();
  const { data: agents, isLoading, error } = useAgents(locationId);
  const deleteAgent = useDeleteAgent(locationId);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "modified">("modified");
  const [showImport, setShowImport] = useState(false);

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    const result = agents.filter(
      (a) =>
        !search ||
        (a.agent_name || "").toLowerCase().includes(search.toLowerCase()) ||
        a.agent_id.toLowerCase().includes(search.toLowerCase())
    );
    result.sort((a, b) => {
      if (sortBy === "name") {
        return (a.agent_name || "").localeCompare(b.agent_name || "");
      }
      return b.last_modification_timestamp - a.last_modification_timestamp;
    });
    return result;
  }, [agents, search, sortBy]);

  const handleDelete = async (agentId: string, agentName: string) => {
    if (
      !confirm(
        `Delete agent "${agentName || "Unnamed"}"? This cannot be undone.`
      )
    )
      return;
    try {
      await deleteAgent.mutateAsync(agentId);
      toast("Agent deleted successfully", "success");
    } catch {
      toast("Failed to delete agent", "error");
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-8 animate-fade-in">
      <PageHeader
        title="Voice Agents"
        description="Manage your AI voice agents"
        className="mb-6"
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => setShowImport(true)}
            >
              Import Agents
            </Button>
            <Link href={`/retell/${locationId}/agents/new`}>
              <Button icon={Plus}>Create Agent</Button>
            </Link>
          </>
        }
      />

      <div className="bg-white rounded-t-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 max-w-sm">
            <SearchInput
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowUpDown}
              onClick={() =>
                setSortBy(sortBy === "name" ? "modified" : "name")
              }
            >
              {sortBy === "name" ? "Name" : "Recent"}
            </Button>

            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 transition-all duration-150",
                  viewMode === "grid"
                    ? "bg-brand-50 text-brand-600"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 transition-all duration-150",
                  viewMode === "list"
                    ? "bg-brand-50 text-brand-600"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-sm p-5 min-h-[400px]">
        {isLoading && <LoadingSkeleton count={6} viewMode={viewMode} />}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-8 text-center">
            <p className="text-sm text-red-600 font-medium">
              Failed to load agents
            </p>
            <p className="text-xs text-gray-500 mt-1.5">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredAgents.length === 0 && (
          <EmptyState
            title={search ? "No agents found" : "No agents yet"}
            description={
              search
                ? "Try a different search term"
                : "Import existing agents from your Retell account or create a new one"
            }
            actionLabel={search ? undefined : "Import Agents"}
            onAction={search ? undefined : () => setShowImport(true)}
          />
        )}

        {!isLoading && !error && filteredAgents.length > 0 && (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                : "flex flex-col gap-2"
            )}
          >
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.agent_id}
                agent={agent}
                locationId={locationId}
                viewMode={viewMode}
                onDelete={() =>
                  handleDelete(agent.agent_id, agent.agent_name || "")
                }
              />
            ))}
          </div>
        )}
      </div>

      {agents && agents.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-400">
          Showing {filteredAgents.length} of {agents.length} agent
          {agents.length !== 1 ? "s" : ""}
        </div>
      )}

      {showImport && (
        <ImportModal
          locationId={locationId}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
