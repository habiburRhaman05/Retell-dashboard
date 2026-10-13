"use client";

import { useLocation } from "@/providers/location-provider";
import {
  useAgents,
  useDeleteAgent,
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
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CreateAgentModal } from "@/components/agents/create-agent-modal";

export default function AgentsPage() {
  const { locationId } = useLocation();
  const { data: agents, isLoading, error } = useAgents(locationId);
  const deleteAgent = useDeleteAgent(locationId);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "modified">("modified");
  const [showCreate, setShowCreate] = useState(false);

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    const result = agents.filter(
      (a) =>
        (!search ||
        (a.agent_name || "").toLowerCase().includes(search.toLowerCase()) ||
        a.agent_id.toLowerCase().includes(search.toLowerCase()))
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
    <div className="max-w-none mx-auto px-4 lg:px-6 py-8 animate-fade-in">
      <PageHeader
        title="Voice Agents"
        description="Manage your AI voice agents"
        className="mb-6"
        actions={
          <Button icon={Plus} onClick={() => setShowCreate(true)}>
            Create Agent
          </Button>
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
                : "Create a new agent to get started"
            }
            actionLabel={search ? undefined : "Create Agent"}
            onAction={search ? undefined : () => setShowCreate(true)}
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

      {showCreate && (
        <CreateAgentModal locationId={locationId} onClose={() => setShowCreate(false)} />
      )}

    </div>
  );
}
