"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsSummary } from "@/types/retell";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export function useAnalytics(locationId: string, start: number, end: number) {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", locationId, start, end],
    queryFn: () =>
      fetchJson<AnalyticsSummary>(
        `/api/retell/analytics?locationId=${encodeURIComponent(locationId)}&start=${start}&end=${end}`
      ),
    enabled: !!locationId,
    placeholderData: (prev) => prev,
  });
}
