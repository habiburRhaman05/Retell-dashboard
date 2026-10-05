"use client";

import { useParams, useRouter } from "next/navigation";
import { useLocation } from "@/providers/location-provider";
import { useAgentDetail } from "@/hooks/use-agent-detail";
import { useUpdateAgent } from "@/hooks/use-agents";
import { useToast } from "@/components/layout/toast";
import { AgentForm } from "@/components/agents/agent-form";
import type { CreateAgentFormData } from "@/lib/validators";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function EditAgentPage() {
  const params = useParams<{ agentId: string }>();
  const { locationId } = useLocation();
  const router = useRouter();
  const { toast } = useToast();
  const agentId = params.agentId;

  const { data: agent, isLoading } = useAgentDetail(agentId, locationId);
  const updateAgent = useUpdateAgent(locationId);

  const handleSubmit = async (data: CreateAgentFormData) => {
    try {
      await updateAgent.mutateAsync({ agentId, data });
      toast("Agent updated successfully!", "success");
      router.push(`/retell/${locationId}/agents/${agentId}`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update agent",
        "error"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 lg:px-6 py-6 animate-pulse">
        <div className="h-4 w-28 bg-gray-200 rounded mb-6" />
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
        </div>
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-[800px] mx-auto px-4 lg:px-6 py-12 text-center">
        <p className="text-red-500 text-sm">Agent not found</p>
        <Link
          href={`/retell/${locationId}/dashboard`}
          className="text-cyan-500 text-sm mt-3 inline-block hover:underline"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 lg:px-6 py-6">
      <Link
        href={`/retell/${locationId}/agents/${agentId}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Agent
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Edit Agent</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Update {agent.agent_name || "Unnamed Agent"} configuration
        </p>
      </div>

      <AgentForm
        defaultValues={agent}
        onSubmit={handleSubmit}
        isSubmitting={updateAgent.isPending}
        mode="edit"
      />
    </div>
  );
}
