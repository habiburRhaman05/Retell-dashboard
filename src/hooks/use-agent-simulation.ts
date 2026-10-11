"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChatTurn } from "@/hooks/use-agent-chat";

export type SimulationStatus = "pending" | "in_progress" | "pass" | "fail" | "error";

export interface SimulationState {
  status: SimulationStatus;
  done: boolean;
  transcript: ChatTurn[];
  explanation: string | null;
}

async function readError(res: Response, fallback: string) {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error) return parsed.error as string;
  } catch {
    if (text) return text;
  }
  return fallback;
}

export function useStartSimulation(agentId: string, locationId: string) {
  return useMutation({
    mutationFn: async (input: {
      userPrompt: string;
      metrics: string[];
      dynamicVariables: Record<string, string>;
      model: string;
    }): Promise<{ batchId: string }> => {
      const res = await fetch(`/api/retell/agents/${agentId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, locationId }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not start the simulation"));
      return res.json();
    },
  });
}

/** Polls every few seconds until the run has finished. */
export function useSimulation(agentId: string, locationId: string, batchId: string | null) {
  return useQuery<SimulationState>({
    queryKey: ["simulation", batchId],
    enabled: !!batchId,
    retry: 2,
    refetchInterval: (query) => (query.state.data?.done ? false : 3000),
    queryFn: async () => {
      const res = await fetch(
        `/api/retell/agents/${agentId}/simulate?locationId=${encodeURIComponent(locationId)}&batchId=${encodeURIComponent(batchId ?? "")}`
      );
      if (!res.ok) throw new Error(await readError(res, "Could not read the simulation"));
      return res.json();
    },
  });
}

export function cancelSimulation(agentId: string, locationId: string, batchId: string) {
  return fetch(
    `/api/retell/agents/${agentId}/simulate?locationId=${encodeURIComponent(locationId)}&batchId=${encodeURIComponent(batchId)}`,
    { method: "DELETE" }
  ).catch(() => undefined);
}
