"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useCreateKnowledgeBase } from "@/hooks/use-knowledge-bases";
import { useToast } from "@/components/layout/toast";
import { SourceInputPanel, type SourceInputValue } from "./source-input";

export function CreateKnowledgeBaseModal({
  locationId,
  onClose,
  onCreated,
}: {
  locationId: string;
  onClose: () => void;
  onCreated: (kbId: string) => void;
}) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [sources, setSources] = useState<SourceInputValue>({
    files: [],
    texts: [],
    urls: [],
  });
  const createKb = useCreateKnowledgeBase(locationId);
  const { toast } = useToast();

  const totalSources = sources.files.length + sources.texts.length + sources.urls.length;

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Knowledge base name is required");
      return;
    }
    if (trimmedName.length >= 40) {
      setNameError("Name must be less than 40 characters");
      return;
    }
    setNameError(null);

    try {
      const kb = await createKb.mutateAsync({
        name: trimmedName,
        texts: sources.texts,
        urls: sources.urls,
        files: sources.files,
        enableAutoRefresh: autoRefresh,
      });
      toast("Knowledge base created", "success");
      onCreated(kb.knowledge_base_id);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to create knowledge base",
        "error"
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create Knowledge Base</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Add documents, text, or URLs your agents can reference
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="mb-5">
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              placeholder="e.g. Product FAQ"
              maxLength={39}
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all ${
                nameError ? "border-red-300" : "border-gray-200"
              }`}
            />
            {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
          </div>

          <div className="mb-2">
            <label className="block text-[13px] font-medium text-gray-700 mb-2">
              Sources (optional, add later too)
            </label>
            <SourceInputPanel value={sources} onChange={setSources} />
          </div>

          <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500/20"
            />
            <span className="text-[13px] text-gray-700">
              Auto-refresh URL and file sources daily
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-xl shrink-0">
          <span className="text-xs text-gray-500">
            {totalSources} source{totalSources !== 1 ? "s" : ""} attached
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createKb.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createKb.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {createKb.isPending ? "Creating..." : "Create Knowledge Base"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
