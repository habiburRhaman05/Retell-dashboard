"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useLocationName(locationId: string) {
  return useQuery<string | null>({
    queryKey: ["location-name", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/locations/${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error("Could not load the account name");
      const data = (await res.json()) as { name: string | null };
      return data.name;
    },
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveLocationName(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/locations/${encodeURIComponent(locationId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = "Could not save the name";
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) message = parsed.error;
        } catch {
          // keep the default
        }
        throw new Error(message);
      }
      return (await res.json()) as { name: string | null };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["location-name", locationId], data.name);
    },
  });
}
