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
  type SourceInputPanelHandle,
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
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  const sourcePanelRef = useRef<SourceInputPanelHandle>(null);
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
    // Pick up anything typed into the Text/URL tab that wasn't explicitly
    // "Added" yet - otherwise it silently vanishes on submit.
    const committed = sourcePanelRef.current?.commitPending() ?? newSources;
    const total = committed.files.length + committed.texts.length + committed.urls.length;
    if (total === 0) {
      toast("Add at least one file, text entry, or URL", "error");
      return;
    }
    try {
      await addSourcesMut.mutateAsync(committed);
      toast("Sources added. Processing may take a moment", "success");
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
      <div className="flex flex-col items-center justify-center gap-3 h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        <p className="text-sm text-gray-500">Loading knowledge base...</p>
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
          className="text-brand-500 text-sm mt-3 inline-block hover:underline"
        >
          Back to Knowledge Bases
        </Link>
      </div>
    );
  }

  const sources = kb.knowledge_base_sources || [];
  const docCount = sources.filter((x) => x.type === "document").length;
  const textCount = sources.filter((x) => x.type === "text").length;
  const urlCount = sources.filter((x) => x.type === "url").length;

  return (
    <div className="h-full flex flex-col">
      {/* Hero header */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 shrink-0">
        <div className="max-w-none mx-auto py-4 flex items-center gap-4">
          <Link
            href={`/retell/${locationId}/knowledge-base`}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Back to knowledge bases"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-sm shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-900 truncate tracking-tight">
                {kb.knowledge_base_name}
              </h1>
              <StatusBadge status={kb.status} />
            </div>
            <p className="text-[12px] text-gray-500 mt-0.5 font-mono truncate">
              {kb.knowledge_base_id}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              icon={Copy}
              onClick={copyId}
              className="hidden sm:inline-flex font-mono"
            >
              ID
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={Trash2}
              loading={deleteKbMut.isPending}
              onClick={handleDeleteKb}
            >
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto bg-gray-50/70">
        <div className="max-w-none mx-auto px-4 lg:px-6 py-6 space-y-5 animate-fade-in">
          {(kb.status === "in_progress" || kb.status === "refreshing_in_progress") && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
              <p className="text-[13px] text-amber-700">
                {kb.status === "in_progress"
                  ? "Processing sources. This page will update automatically when ready."
                  : "Refreshing sources. This page will update automatically when done."}
              </p>
            </div>
          )}

          {kb.status === "error" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-[13px] text-red-700">
                Something went wrong processing this knowledge base. Try removing the
                problematic source and adding it again.
              </p>
            </div>
          )}

          {/* Summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryTile icon={FileText} label="Files" value={String(docCount)} />
            <SummaryTile icon={Type} label="Text entries" value={String(textCount)} />
            <SummaryTile icon={Link2} label="URLs" value={String(urlCount)} />
            <SummaryTile
              icon={RefreshCw}
              label="Auto-refresh"
              value={kb.enable_auto_refresh ? "On" : "Off"}
              hint={
                kb.last_refreshed_timestamp
                  ? `Last ${new Date(kb.last_refreshed_timestamp).toLocaleDateString()}`
                  : `Chunks ${kb.min_chunk_size ?? 400}-${kb.max_chunk_size ?? 2000}`
              }
            />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-[14px] font-semibold text-gray-900">Sources</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {sources.length} source{sources.length !== 1 ? "s" : ""} your agents can reference
                </p>
              </div>
              <Button
                size="sm"
                variant={showAddPanel ? "secondary" : "primary"}
                icon={showAddPanel ? X : Plus}
                onClick={() => setShowAddPanel((v) => !v)}
              >
                {showAddPanel ? "Cancel" : "Add Sources"}
              </Button>
            </div>

            {showAddPanel && (
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 animate-fade-in">
                <SourceInputPanel ref={sourcePanelRef} value={newSources} onChange={setNewSources} />
                <div className="flex justify-end mt-4">
                  <Button
                    loading={addSourcesMut.isPending}
                    disabled={addSourcesMut.isPending}
                    onClick={handleAddSources}
                  >
                    {addSourcesMut.isPending ? "Uploading..." : "Add to Knowledge Base"}
                  </Button>
                </div>
              </div>
            )}

            {sources.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No sources yet</p>
                <p className="text-xs text-gray-500 mt-1">
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
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-3">
      <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-lg font-semibold text-gray-900 leading-tight">{value}</p>
        {hint && <p className="text-[11px] text-gray-400 truncate">{hint}</p>}
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
    <li className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand-600" />
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
          className="text-[11px] text-brand-600 hover:underline shrink-0"
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
