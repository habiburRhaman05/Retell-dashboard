"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
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

export interface AgentLibraryItem {
  agentId: string;
  agentName: string | null;
  channel: "voice" | "chat";
  status: "assigned" | "unassigned" | "private";
  locationId: string | null;
  assignedBy: string | null;
}

export interface KbLibraryItem {
  knowledgeBaseId: string;
  knowledgeBaseName: string | null;
  status: "assigned" | "unassigned" | "private";
  locationId: string | null;
  assignedBy: string | null;
}

export function useAgentLibrary() {
  return useQuery<AgentLibraryItem[]>({
    queryKey: ["admin-library", "agents"],
    queryFn: () => fetchJson<AgentLibraryItem[]>("/api/admin/library/agents"),
  });
}

export function useKbLibrary() {
  return useQuery<KbLibraryItem[]>({
    queryKey: ["admin-library", "kbs"],
    queryFn: () => fetchJson<KbLibraryItem[]>("/api/admin/library/kbs"),
  });
}

function useLibraryMutation<T>(endpoint: string) {
  const queryClient = useQueryClient();
  return useMutation<T, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      fetchJson<T>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-library"] });
    },
  });
}

export function useAssignAgents() {
  return useLibraryMutation<{ assigned: number; skipped: string[] }>(
    "/api/admin/library/agents/assign"
  );
}

export function useUnassignAgents() {
  return useLibraryMutation<{ unassigned: number }>(
    "/api/admin/library/agents/unassign"
  );
}

export function useMakeAgentsPrivate() {
  return useLibraryMutation<{ marked: number }>(
    "/api/admin/library/agents/private"
  );
}

export function useMakeAgentsPublic() {
  return useLibraryMutation<{ unmarked: number }>(
    "/api/admin/library/agents/unprivate"
  );
}

export function useAssignKbs() {
  return useLibraryMutation<{ assigned: number; skipped: string[] }>(
    "/api/admin/library/kbs/assign"
  );
}

export function useUnassignKbs() {
  return useLibraryMutation<{ unassigned: number }>(
    "/api/admin/library/kbs/unassign"
  );
}

export function useMakeKbsPrivate() {
  return useLibraryMutation<{ marked: number }>(
    "/api/admin/library/kbs/private"
  );
}

export function useMakeKbsPublic() {
  return useLibraryMutation<{ unmarked: number }>(
    "/api/admin/library/kbs/unprivate"
  );
}
