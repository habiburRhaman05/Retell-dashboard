"use client";

import { useQuery } from "@tanstack/react-query";
import type { RetellAgent } from "@/types/retell";

export function useAgentDetail(agentId: string, locationId: string) {
  return useQuery<RetellAgent>({
    queryKey: ["agent", agentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/retell/agents/${agentId}?locationId=${encodeURIComponent(locationId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch agent");
      return res.json();
    },
    enabled: !!agentId && !!locationId,
  });
}
