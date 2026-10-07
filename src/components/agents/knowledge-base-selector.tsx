"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X, Loader2, BookOpen, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKnowledgeBases } from "@/hooks/use-knowledge-bases";

export function KnowledgeBaseSelector({
  locationId,
  attachedIds,
  isLoading,
  isSaving,
  onSave,
}: {
  locationId: string;
  attachedIds: string[];
  isLoading?: boolean;
  isSaving?: boolean;
  onSave: (ids: string[]) => void;
}) {
  const { data: knowledgeBases, isLoading: kbListLoading, error } = useKnowledgeBases(locationId);
  const [showPicker, setShowPicker] = useState(false);

  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const kb of knowledgeBases ?? []) map.set(kb.knowledge_base_id, kb.knowledge_base_name);
    return map;
  }, [knowledgeBases]);

  const available = (knowledgeBases ?? []).filter(
    (kb) => !attachedIds.includes(kb.knowledge_base_id)
  );

  const attach = (id: string) => {
    onSave([...attachedIds, id]);
    setShowPicker(false);
  };

  const detach = (id: string) => {
    onSave(attachedIds.filter((existing) => existing !== id));
  };

  if (isLoading) {
    return (
      <div className="px-4 py-6 flex items-center justify-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[12px]">Loading agent configuration...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] text-gray-600">Knowledge Base</p>
        {isSaving && <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />}
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Attach a knowledge base so this agent can reference your documents,
        text, and URLs while talking to callers.
      </p>

      {attachedIds.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {attachedIds.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 text-[12px]"
            >
              <div className="min-w-0 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate text-gray-700">
                  {byId.get(id) || (kbListLoading ? "Loading…" : id)}
                </span>
              </div>
              <button
                onClick={() => detach(id)}
                disabled={isSaving}
                className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 shrink-0 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="text-[11px] text-red-500 mb-2">
          Couldn&apos;t load this location&apos;s knowledge bases: {error.message}
        </p>
      ) : !kbListLoading && (knowledgeBases ?? []).length === 0 ? (
        <div className="text-[12px] text-gray-400 py-2">
          No knowledge bases in this location yet.{" "}
          <Link
            href={`/retell/${locationId}/knowledge-base`}
            className="text-brand-600 hover:underline inline-flex items-center gap-0.5"
          >
            Create one <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      ) : showPicker ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          {kbListLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[11px]">Loading knowledge bases...</span>
            </div>
          ) : available.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center py-3">
              All available knowledge bases are already attached
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              {available.map((kb) => (
                <li key={kb.knowledge_base_id}>
                  <button
                    onClick={() => attach(kb.knowledge_base_id)}
                    disabled={isSaving}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <span className="min-w-0 flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate text-[12px] text-gray-700">
                        {kb.knowledge_base_name}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                        kb.status === "complete"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      )}
                    >
                      {kb.status === "complete" ? "Ready" : kb.status.replace(/_/g, " ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setShowPicker(false)}
            className="w-full text-center py-2 text-[11px] text-gray-500 hover:bg-gray-50 border-t border-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-[12px] font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Add Knowledge Base
        </button>
      )}

      {attachedIds.length > 0 && !showPicker && available.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-2 inline-flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-500" />
          {attachedIds.length} attached
        </p>
      )}
    </div>
  );
}
