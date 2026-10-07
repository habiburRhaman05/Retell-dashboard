"use client";

import { useMemo, useState } from "react";
import { X, Check, Download } from "lucide-react";
import { SearchInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/layout/toast";
import {
  useAvailableKnowledgeBases,
  useImportKnowledgeBases,
} from "@/hooks/use-knowledge-bases";

export function ImportKnowledgeBaseModal({
  locationId,
  onClose,
}: {
  locationId: string;
  onClose: () => void;
}) {
  const { data: available, isLoading, error } = useAvailableKnowledgeBases(
    locationId,
    true
  );
  const importKbs = useImportKnowledgeBases(locationId);
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!available) return [];
    if (!search) return available;
    return available.filter(
      (kb) =>
        kb.knowledge_base_name.toLowerCase().includes(search.toLowerCase()) ||
        kb.knowledge_base_id.toLowerCase().includes(search.toLowerCase())
    );
  }, [available, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!filtered) return;
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((kb) => kb.knowledge_base_id)));
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    try {
      const result = await importKbs.mutateAsync([...selected]);
      toast(
        `Imported ${result.imported} knowledge base${result.imported !== 1 ? "s" : ""}`,
        "success"
      );
      onClose();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to import knowledge bases",
        "error"
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Import Knowledge Bases</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select knowledge bases from your Retell account to add to this location
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <SearchInput
            placeholder="Search available knowledge bases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-gray-500">Loading knowledge bases...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm text-red-600 font-medium">
                Failed to load available knowledge bases
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {error instanceof Error ? error.message : "Please try again"}
              </p>
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">
                {search
                  ? "No matching knowledge bases found"
                  : "No unassigned knowledge bases available"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                All knowledge bases are already assigned to a location
              </p>
            </div>
          )}

          {!isLoading && !error && filtered.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={selectAll}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  {selected.size === filtered.length ? "Deselect all" : "Select all"}
                </button>
                <span className="text-xs text-gray-400">
                  {filtered.length} available
                </span>
              </div>
              <div className="space-y-2">
                {filtered.map((kb) => (
                  <button
                    key={kb.knowledge_base_id}
                    onClick={() => toggleSelect(kb.knowledge_base_id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                      selected.has(kb.knowledge_base_id)
                        ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/20"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                        selected.has(kb.knowledge_base_id)
                          ? "bg-brand-500 border-brand-500"
                          : "border-gray-300"
                      )}
                    >
                      {selected.has(kb.knowledge_base_id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {kb.knowledge_base_name}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400 font-mono">
                          {kb.knowledge_base_id.slice(0, 16)}...
                        </span>
                        <span className="text-xs text-gray-500">
                          {kb.knowledge_base_sources?.length ?? 0} sources
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium capitalize",
                        kb.status === "complete"
                          ? "bg-green-50 text-green-600"
                          : kb.status === "error"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                      )}
                    >
                      {kb.status.replace(/_/g, " ")}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-xl">
          <span className="text-xs text-gray-500">
            {selected.size} knowledge base{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importKbs.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importKbs.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Import Selected
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
