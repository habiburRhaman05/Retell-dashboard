"use client";

import { useQuery } from "@tanstack/react-query";
import type { RetellVoice } from "@/types/retell";

export function useVoices() {
  return useQuery<RetellVoice[]>({
    queryKey: ["voices"],
    queryFn: async () => {
      const res = await fetch("/api/retell/voices");
      if (!res.ok) {
        const text = await res.text();
        let message = "Failed to load voices";
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) message = parsed.error;
        } catch {
          if (text) message = text;
        }
        throw new Error(message);
      }
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}
