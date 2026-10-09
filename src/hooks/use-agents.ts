"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { RetellAgent, CreateAgentPayload, UpdateAgentPayload } from "@/types/retell";

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
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function useAgents(locationId: string) {
  return useQuery<RetellAgent[]>({
    queryKey: ["agents", locationId],
    queryFn: () =>
      fetchJson<RetellAgent[]>(
        `/api/retell/agents?locationId=${encodeURIComponent(locationId)}`
      ),
    enabled: !!locationId,
  });
}

export function useCreateAgent(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentPayload) =>
      fetchJson<RetellAgent>("/api/retell/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locationId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", locationId] });
    },
  });
}

export function useUpdateAgent(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      agentId,
      data,
    }: {
      agentId: string;
      data: UpdateAgentPayload;
    }) =>
      fetchJson<RetellAgent>(`/api/retell/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locationId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", locationId] });
    },
  });
}

export function useDeleteAgent(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) =>
      fetchJson<void>(
        `/api/retell/agents/${agentId}?locationId=${encodeURIComponent(locationId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", locationId] });
    },
  });
}

export function useAvailableAgents(locationId: string, enabled = false) {
  return useQuery<RetellAgent[]>({
    queryKey: ["available-agents", locationId],
    queryFn: () =>
      fetchJson<RetellAgent[]>(
        `/api/retell/agents/available?locationId=${encodeURIComponent(locationId)}`
      ),
    enabled: !!locationId && enabled,
  });
}

export function useImportAgents(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentIds: string[]) =>
      fetchJson<{ imported: number; agentIds: string[] }>(
        "/api/retell/agents/import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, agentIds }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", locationId] });
      queryClient.invalidateQueries({ queryKey: ["available-agents", locationId] });
    },
  });
}

export interface CreateAgentFromTemplateInput {
  name: string;
  channel?: "voice" | "text";
  type: "single" | "flow";
  templateId?: string | null;
  businessName?: string;
  voiceId?: string;
  language: string | string[];
}

export function useCreateAgentFromTemplate(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentFromTemplateInput) =>
      fetchJson<RetellAgent>("/api/retell/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locationId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", locationId] });
    },
  });
}
