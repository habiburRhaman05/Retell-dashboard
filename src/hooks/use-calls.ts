"use client";

import { useQuery } from "@tanstack/react-query";
import type { RetellCall } from "@/types/retell";

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

export interface CallHistoryFilters {
  start?: number;
  end?: number;
  page?: number;
  pageSize?: number;
  status?: string;
  direction?: string;
  sentiment?: string;
  disconnectionReason?: string;
  callSuccessful?: boolean;
}

export interface CallHistoryPage {
  items: RetellCall[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
}

export function buildQuery(filters: CallHistoryFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// locationId is never passed here: the route derives the tenant purely from
// the session cookie, which fetch() already sends same-origin.
export function useCallHistory(filters: CallHistoryFilters) {
  return useQuery<CallHistoryPage>({
    queryKey: ["calls", filters],
    queryFn: () => fetchJson<CallHistoryPage>(`/api/tenant/calls${buildQuery(filters)}`),
    placeholderData: (prev) => prev,
  });
}

export interface CallDetailResponse {
  call: RetellCall;
  logLines: string[];
}

export function useCallDetail(callId: string | null) {
  return useQuery<CallDetailResponse>({
    queryKey: ["calls", "detail", callId],
    queryFn: () => fetchJson<CallDetailResponse>(`/api/tenant/calls/${encodeURIComponent(callId!)}`),
    enabled: !!callId,
  });
}
