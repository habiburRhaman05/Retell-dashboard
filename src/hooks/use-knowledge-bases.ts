"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { KnowledgeBase, KnowledgeBaseTextInput } from "@/types/retell";

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

const PROCESSING_STATUSES = new Set(["in_progress", "refreshing_in_progress"]);

export function useKnowledgeBases(locationId: string) {
  return useQuery<KnowledgeBase[]>({
    queryKey: ["knowledge-bases", locationId],
    queryFn: () =>
      fetchJson<KnowledgeBase[]>(
        `/api/retell/knowledge-base?locationId=${encodeURIComponent(locationId)}`
      ),
    enabled: !!locationId,
    refetchInterval: (query) => {
      const data = query.state.data;
      const stillProcessing = data?.some((kb) =>
        PROCESSING_STATUSES.has(kb.status)
      );
      return stillProcessing ? 4000 : false;
    },
  });
}

export function useKnowledgeBaseDetail(kbId: string, locationId: string) {
  return useQuery<KnowledgeBase>({
    queryKey: ["knowledge-base", kbId],
    queryFn: () =>
      fetchJson<KnowledgeBase>(
        `/api/retell/knowledge-base/${kbId}?locationId=${encodeURIComponent(locationId)}`
      ),
    enabled: !!kbId && !!locationId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && PROCESSING_STATUSES.has(status) ? 3000 : false;
    },
  });
}

export interface CreateKnowledgeBaseInput {
  name: string;
  texts?: KnowledgeBaseTextInput[];
  urls?: string[];
  files?: File[];
  enableAutoRefresh?: boolean;
}

function buildSourceFormData(input: {
  texts?: KnowledgeBaseTextInput[];
  urls?: string[];
  files?: File[];
}): FormData {
  const form = new FormData();
  if (input.texts && input.texts.length > 0) {
    form.append("knowledge_base_texts", JSON.stringify(input.texts));
  }
  if (input.urls && input.urls.length > 0) {
    form.append("knowledge_base_urls", JSON.stringify(input.urls));
  }
  if (input.files) {
    for (const file of input.files) {
      form.append("knowledge_base_files", file, file.name);
    }
  }
  return form;
}

export function useCreateKnowledgeBase(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateKnowledgeBaseInput) => {
      const form = buildSourceFormData(data);
      form.append("locationId", locationId);
      form.append("knowledge_base_name", data.name);
      if (data.enableAutoRefresh !== undefined) {
        form.append("enable_auto_refresh", String(data.enableAutoRefresh));
      }
      return fetchJson<KnowledgeBase>("/api/retell/knowledge-base", {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases", locationId] });
    },
  });
}

export function useDeleteKnowledgeBase(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (kbId: string) =>
      fetchJson<void>(
        `/api/retell/knowledge-base/${kbId}?locationId=${encodeURIComponent(locationId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases", locationId] });
    },
  });
}

export function useAddKnowledgeBaseSources(kbId: string, locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      texts?: KnowledgeBaseTextInput[];
      urls?: string[];
      files?: File[];
    }) => {
      const form = buildSourceFormData(data);
      form.append("locationId", locationId);
      return fetchJson<KnowledgeBase>(
        `/api/retell/knowledge-base/${kbId}/sources`,
        { method: "POST", body: form }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases", locationId] });
    },
  });
}

export function useDeleteKnowledgeBaseSource(kbId: string, locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) =>
      fetchJson<KnowledgeBase>(
        `/api/retell/knowledge-base/${kbId}/sources/${sourceId}?locationId=${encodeURIComponent(locationId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases", locationId] });
    },
  });
}

export function useAvailableKnowledgeBases(locationId: string, enabled = false) {
  return useQuery<KnowledgeBase[]>({
    queryKey: ["available-knowledge-bases", locationId],
    queryFn: () =>
      fetchJson<KnowledgeBase[]>(
        `/api/retell/knowledge-base/available?locationId=${encodeURIComponent(locationId)}`
      ),
    enabled: !!locationId && enabled,
  });
}

export function useImportKnowledgeBases(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (knowledgeBaseIds: string[]) =>
      fetchJson<{ imported: number; knowledgeBaseIds: string[] }>(
        "/api/retell/knowledge-base/import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, knowledgeBaseIds }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases", locationId] });
      queryClient.invalidateQueries({ queryKey: ["available-knowledge-bases", locationId] });
    },
  });
}
