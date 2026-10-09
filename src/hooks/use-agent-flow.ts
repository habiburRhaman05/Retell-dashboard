"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface FlowEdgeData {
  id: string;
  transition_condition: { type: string; prompt?: string; [k: string]: unknown };
  destination_node_id: string;
  [k: string]: unknown;
}

export interface FlowNodeData {
  id: string;
  type: string;
  name?: string;
  display_position?: { x: number; y: number };
  instruction?: { type: string; text?: string; [k: string]: unknown };
  edges?: FlowEdgeData[];
  else_edge?: FlowEdgeData;
  skip_response_edge?: FlowEdgeData;
  always_edge?: FlowEdgeData;
  edge?: FlowEdgeData;
  success_edge?: FlowEdgeData;
  failed_edge?: FlowEdgeData;
  [k: string]: unknown;
}

export interface FlowNoteData {
  id: string;
  content: string;
  display_position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface ConversationFlowData {
  conversation_flow_id: string;
  version: number;
  global_prompt?: string | null;
  start_speaker?: "user" | "agent";
  start_node_id?: string | null;
  flex_mode?: boolean;
  model_choice?: { type: string; model?: string; [k: string]: unknown };
  knowledge_base_ids?: string[] | null;
  nodes: FlowNodeData[];
  notes?: FlowNoteData[] | null;
  [k: string]: unknown;
}

async function parseError(res: Response, fallback: string) {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error) return parsed.error as string;
  } catch {
    if (text) return text;
  }
  return fallback;
}

export function useAgentFlow(agentId: string, locationId: string, enabled: boolean) {
  return useQuery<ConversationFlowData>({
    queryKey: ["agent-flow", agentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/retell/agents/${agentId}/flow?locationId=${encodeURIComponent(locationId)}`
      );
      if (!res.ok) throw new Error(await parseError(res, "Failed to load workflow"));
      return res.json();
    },
    enabled: enabled && !!agentId && !!locationId,
  });
}

export function useUpdateAgentFlow(agentId: string, locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>): Promise<ConversationFlowData> => {
      const res = await fetch(`/api/retell/agents/${agentId}/flow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, locationId }),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to save workflow"));
      return res.json();
    },
    onSuccess: (flow) => {
      queryClient.setQueryData(["agent-flow", agentId], flow);
    },
  });
}
