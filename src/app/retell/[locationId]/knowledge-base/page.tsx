"use client";

import { useLocation } from "@/providers/location-provider";
import {
  useKnowledgeBases,
  useDeleteKnowledgeBase,
} from "@/hooks/use-knowledge-bases";
import { useToast } from "@/components/layout/toast";
import { KnowledgeBaseCard } from "@/components/knowledge-base/kb-card";
import { CreateKnowledgeBaseModal } from "@/components/knowledge-base/create-kb-modal";
import { ImportKnowledgeBaseModal } from "@/components/knowledge-base/import-kb-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import {
  LayoutGrid,
  List,
  ArrowUpDown,
  Plus,
  Download,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function KnowledgeBasePage() {
  const { locationId } = useLocation();
  const router = useRouter();
  const { data: kbs, isLoading, error } = useKnowledgeBases(locationId);
  const deleteKb = useDeleteKnowledgeBase(locationId);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "status">("name");
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const filteredKbs = useMemo(() => {
    if (!kbs) return [];
    const result = kbs.filter(
      (kb) =>
        !search ||
        kb.knowledge_base_name.toLowerCase().includes(search.toLowerCase()) ||
        kb.knowledge_base_id.toLowerCase().includes(search.toLowerCase())
    );
    result.sort((a, b) => {
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      return a.knowledge_base_name.localeCompare(b.knowledge_base_name);
    });
    return result;
  }, [kbs, search, sortBy]);

  const handleDelete = async (kbId: string, kbName: string) => {
    if (
      !confirm(
        `Delete knowledge base "${kbName || "Unnamed"}"? This cannot be undone and will remove it from any agents using it.`
      )
    )
      return;
    try {
      await deleteKb.mutateAsync(kbId);
      toast("Knowledge base deleted", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to delete knowledge base",
        "error"
      );
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-8 animate-fade-in">
      <PageHeader
        title="Knowledge Bases"
        description="Manage documents, text, and URLs your agents can reference"
        className="mb-6"
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => setShowImport(true)}
            >
              Import
            </Button>
            <Button icon={Plus} onClick={() => setShowCreate(true)}>
              Create Knowledge Base
            </Button>
          </>
        }
      />

      <div className="bg-white rounded-t-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 max-w-sm">
            <SearchInput
              placeholder="Search knowledge bases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowUpDown}
              onClick={() => setSortBy(sortBy === "name" ? "status" : "name")}
            >
              {sortBy === "name" ? "Name" : "Status"}
            </Button>

            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 transition-all duration-150",
                  viewMode === "grid"
                    ? "bg-brand-50 text-brand-600"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 transition-all duration-150",
                  viewMode === "list"
                    ? "bg-brand-50 text-brand-600"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-sm p-5 min-h-[400px]">
        {isLoading && <LoadingSkeleton count={6} viewMode={viewMode} />}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-8 text-center">
            <p className="text-sm text-red-600 font-medium">
              Failed to load knowledge bases
            </p>
            <p className="text-xs text-gray-500 mt-1.5">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredKbs.length === 0 && (
          <EmptyState
            title={search ? "No knowledge bases found" : "No knowledge bases yet"}
            description={
              search
                ? "Try a different search term"
                : "Import existing knowledge bases from your Retell account or create a new one"
            }
            actionLabel={search ? undefined : "Import Knowledge Bases"}
            onAction={search ? undefined : () => setShowImport(true)}
          />
        )}

        {!isLoading && !error && filteredKbs.length > 0 && (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                : "flex flex-col gap-2"
            )}
          >
            {filteredKbs.map((kb) => (
              <KnowledgeBaseCard
                key={kb.knowledge_base_id}
                kb={kb}
                locationId={locationId}
                viewMode={viewMode}
                onDelete={() =>
                  handleDelete(kb.knowledge_base_id, kb.knowledge_base_name)
                }
              />
            ))}
          </div>
        )}
      </div>

      {kbs && kbs.length > 0 && (
        <div className="mt-4 text-center text-xs text-gray-400">
          Showing {filteredKbs.length} of {kbs.length} knowledge base
          {kbs.length !== 1 ? "s" : ""}
        </div>
      )}

      {showImport && (
        <ImportKnowledgeBaseModal
          locationId={locationId}
          onClose={() => setShowImport(false)}
        />
      )}

      {showCreate && (
        <CreateKnowledgeBaseModal
          locationId={locationId}
          onClose={() => setShowCreate(false)}
          onCreated={(kbId) => {
            setShowCreate(false);
            router.push(`/retell/${locationId}/knowledge-base/${kbId}`);
          }}
        />
      )}
    </div>
  );
}
