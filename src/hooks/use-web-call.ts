"use client";

import { useMutation } from "@tanstack/react-query";
import type { CreateWebCallResponse } from "@/types/retell";

export function useCreateWebCall(agentId: string, locationId: string) {
  return useMutation({
    mutationFn: async (): Promise<CreateWebCallResponse> => {
      const res = await fetch(`/api/retell/agents/${agentId}/web-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = "Failed to start test call";
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
  });
}
