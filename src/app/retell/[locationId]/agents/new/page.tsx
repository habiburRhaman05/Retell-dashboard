"use client";

import { useLocation } from "@/providers/location-provider";
import { useCreateAgent } from "@/hooks/use-agents";
import { useToast } from "@/components/layout/toast";
import { AgentForm } from "@/components/agents/agent-form";
import { useRouter } from "next/navigation";
import type { CreateAgentFormData } from "@/lib/validators";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewAgentPage() {
  const { locationId } = useLocation();
  const createAgent = useCreateAgent(locationId);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (data: CreateAgentFormData) => {
    try {
      await createAgent.mutateAsync(data);
      toast("Agent created successfully!", "success");
      router.push(`/retell/${locationId}/dashboard`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to create agent",
        "error"
      );
    }
  };

  return (
    <div className="max-w-[800px] mx-auto px-4 lg:px-6 py-6">
      <Link
        href={`/retell/${locationId}/dashboard`}
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Dashboard
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h1 className="text-lg font-semibold text-gray-900">
          Create Voice Agent
        </h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Configure a new AI voice agent for this account
        </p>
      </div>

      <AgentForm
        onSubmit={handleSubmit}
        isSubmitting={createAgent.isPending}
        mode="create"
      />
    </div>
  );
}
