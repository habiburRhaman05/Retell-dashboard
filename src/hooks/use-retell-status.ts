"use client";

import { useQuery } from "@tanstack/react-query";

export interface RetellStatus {
  connected: boolean;
  latencyMs?: number;
  error?: string;
}

export function useRetellStatus(enabled = true) {
  return useQuery<RetellStatus>({
    queryKey: ["retell-status"],
    queryFn: async () => {
      const res = await fetch("/api/retell/status");
      if (!res.ok) throw new Error("Could not check the connection");
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });
}
