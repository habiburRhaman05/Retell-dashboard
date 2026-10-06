"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentVersion } from "@/types/retell";

async function parseErrorMessage(res: Response, fallback: string) {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error) return parsed.error as string;
  } catch {
    if (text) return text;
  }
  return fallback;
}

export function useAgentVersions(agentId: string, locationId: string) {
  return useQuery<AgentVersion[]>({
    queryKey: ["agent-versions", agentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/retell/agents/${agentId}/versions?locationId=${encodeURIComponent(locationId)}`
      );
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to fetch versions"));
      }
      const data = await res.json();
      return data.items;
    },
    enabled: !!agentId && !!locationId,
  });
}

export function useCreateDraftVersion(agentId: string, locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (baseVersion: number) => {
      const res = await fetch(`/api/retell/agents/${agentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseVersion, locationId }),
      });
      if (!res.ok) {
        throw new Error(
          await parseErrorMessage(res, "Failed to create draft version")
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agent-versions", agentId],
      });
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
    },
  });
}

export function usePublishVersion(agentId: string, locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      version,
      versionTitle,
      versionDescription,
    }: {
      version: number;
      versionTitle?: string;
      versionDescription?: string;
    }) => {
      const res = await fetch(
        `/api/retell/agents/${agentId}/versions/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version,
            versionTitle,
            versionDescription,
            locationId,
          }),
        }
      );
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to publish version"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agent-versions", agentId],
      });
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
    },
  });
}
