"use client";

import { useParams, useRouter } from "next/navigation";
import { useLocation } from "@/providers/location-provider";
import {
  useKnowledgeBaseDetail,
  useDeleteKnowledgeBase,
  useAddKnowledgeBaseSources,
  useDeleteKnowledgeBaseSource,
} from "@/hooks/use-knowledge-bases";
import { useToast } from "@/components/layout/toast";
import { StatusBadge } from "@/components/knowledge-base/kb-card";
import {
  SourceInputPanel,
  type SourceInputValue,
} from "@/components/knowledge-base/source-input";
import {
  ArrowLeft,
  Trash2,
  Copy,
  Loader2,
  FileText,
  Link2,
  Type,
  RefreshCw,
  Plus,
  X,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { KnowledgeBaseSource } from "@/types/retell";

export default function KnowledgeBaseDetailPage() {
  const params = useParams<{ kbId: string }>();
  const { locationId } = useLocation();
  const router = useRouter();
  const { toast } = useToast();
  const kbId = params.kbId;

  const { data: kb, isLoading, error } = useKnowledgeBaseDetail(kbId, locationId);
  const deleteKbMut = useDeleteKnowledgeBase(locationId);
  const addSourcesMut = useAddKnowledgeBaseSources(kbId, locationId);
  const deleteSourceMut = useDeleteKnowledgeBaseSource(kbId, locationId);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newSources, setNewSources] = useState<SourceInputValue>({
    files: [],
    texts: [],
    urls: [],
  });
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

  const handleDeleteKb = async () => {
    if (
      !confirm(
        `Delete knowledge base "${kb?.knowledge_base_name || "Unnamed"}"? This cannot be undone and will remove it from any agents using it.`
      )
    )
      return;
    try {
      await deleteKbMut.mutateAsync(kbId);
      toast("Knowledge base deleted", "success");
      router.push(`/retell/${locationId}/knowledge-base`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to delete knowledge base",
        "error"
      );
    }
  };

  const handleAddSources = async () => {
    const total = newSources.files.length + newSources.texts.length + newSources.urls.length;
    if (total === 0) {
      toast("Add at least one file, text entry, or URL", "error");
      return;
    }
    try {
      await addSourcesMut.mutateAsync(newSources);
      toast("Sources added — processing may take a moment", "success");
      setNewSources({ files: [], texts: [], urls: [] });
      setShowAddPanel(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add sources", "error");
    }
  };

  const handleDeleteSource = async (sourceId: string, label: string) => {
    if (!confirm(`Remove source "${label}"?`)) return;
    setDeletingSourceId(sourceId);
    try {
      await deleteSourceMut.mutateAsync(sourceId);
      toast("Source removed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove source", "error");
    } finally {
      setDeletingSourceId(null);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(kbId);
    toast("Knowledge base ID copied", "info");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error || !kb) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-12 text-center">
        <p className="text-red-500 text-sm">
          {error instanceof Error ? error.message : "Knowledge base not found"}
        </p>
        <Link
          href={`/retell/${locationId}/knowledge-base`}
          className="text-cyan-500 text-sm mt-3 inline-block hover:underline"
        >
          Back to Knowledge Bases
        </Link>
      </div>
    );
  }

  const sources = kb.knowledge_base_sources || [];

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6">
        <div className="max-w-[1000px] mx-auto flex items-center h-[52px] gap-4">
          <Link
            href={`/retell/${locationId}/knowledge-base`}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>

          <h1 className="text-[15px] font-semibold text-gray-900 truncate">
            {kb.knowledge_base_name}
          </h1>

          <div className="flex items-center gap-2 ml-2">
            <StatusBadge status={kb.status} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={copyId}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Copy className="w-3 h-3" /> ID
            </button>
            <button
              onClick={handleDeleteKb}
              disabled={deleteKbMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleteKbMut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 lg:px-6">
        <div className="max-w-[1000px] mx-auto flex items-center h-[40px] gap-6 text-[12px] text-gray-500 overflow-x-auto">
          <span className="shrink-0">{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
          <span className="text-gray-300">|</span>
          <span className="shrink-0">
            Chunk size: {kb.min_chunk_size}–{kb.max_chunk_size} chars
          </span>
          {kb.enable_auto_refresh && (
            <>
              <span className="text-gray-300">|</span>
              <span className="shrink-0 inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Auto-refresh enabled
              </span>
            </>
          )}
          {kb.last_refreshed_timestamp && (
            <>
              <span className="text-gray-300">|</span>
              <span className="shrink-0">
                Last refreshed {new Date(kb.last_refreshed_timestamp).toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1000px] mx-auto px-4 lg:px-6 py-6">
          {(kb.status === "in_progress" || kb.status === "refreshing_in_progress") && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
              <p className="text-[13px] text-amber-700">
                {kb.status === "in_progress"
                  ? "Processing sources — this page will update automatically when ready."
                  : "Refreshing sources — this page will update automatically when done."}
              </p>
            </div>
          )}

          {kb.status === "error" && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-[13px] text-red-700">
                Something went wrong processing this knowledge base. Try removing the
                problematic source and adding it again.
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-[13px] font-semibold text-gray-700">Sources</h2>
              <button
                onClick={() => setShowAddPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-[12px] font-medium hover:bg-cyan-600 transition-colors"
              >
                {showAddPanel ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                {showAddPanel ? "Cancel" : "Add Sources"}
              </button>
            </div>

            {showAddPanel && (
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <SourceInputPanel value={newSources} onChange={setNewSources} />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleAddSources}
                    disabled={addSourcesMut.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 text-white text-[13px] font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {addSourcesMut.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {addSourcesMut.isPending ? "Uploading..." : "Add to Knowledge Base"}
                  </button>
                </div>
              </div>
            )}

            {sources.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No sources yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add files, text, or URLs for your agents to reference
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {sources.map((source) => (
                  <SourceRow
                    key={source.source_id}
                    source={source}
                    isDeleting={deletingSourceId === source.source_id}
                    onDelete={() =>
                      handleDeleteSource(source.source_id, sourceLabel(source))
                    }
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 text-center text-[11px] text-gray-400">
            Knowledge base ID: <span className="font-mono">{kb.knowledge_base_id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function sourceLabel(source: KnowledgeBaseSource): string {
  if (source.type === "document") return source.filename;
  if (source.type === "text") return source.title;
  return source.url;
}

function SourceRow({
  source,
  isDeleting,
  onDelete,
}: {
  source: KnowledgeBaseSource;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const icon =
    source.type === "document" ? FileText : source.type === "text" ? Type : Link2;
  const Icon = icon;

  return (
    <li className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-gray-800 truncate">
          {sourceLabel(source)}
        </p>
        <p className="text-[11px] text-gray-400 capitalize">
          {source.type}
          {source.type === "document" && source.file_size
            ? ` · ${(source.file_size / 1024).toFixed(0)} KB`
            : ""}
        </p>
      </div>
      {source.type === "document" && source.file_url && (
        <a
          href={source.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-cyan-600 hover:underline shrink-0"
        >
          View
        </a>
      )}
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className={cn(
          "p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0",
          isDeleting && "opacity-50 cursor-not-allowed"
        )}
      >
        {isDeleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </li>
  );
}
