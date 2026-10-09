"use client";

import { useMemo, useState } from "react";
import { X, Rocket, Clock, GitBranch, Plus, Copy, CheckCircle2 } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import {
  useAgentVersions,
  usePublishVersion,
  useCreateDraftVersion,
} from "@/hooks/use-agent-versions";
import { useToast } from "@/components/layout/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, SearchInput } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AgentVersion } from "@/types/retell";

type Filter = "all" | "published" | "drafts";

export function VersionHistoryPanel({
  agentId,
  locationId,
  currentVersion,
  onClose,
}: {
  agentId: string;
  locationId: string;
  currentVersion: number;
  onClose: () => void;
}) {
  const { data: versions, isLoading, error, refetch } = useAgentVersions(agentId, locationId);
  const publishMut = usePublishVersion(agentId, locationId);
  const draftMut = useCreateDraftVersion(agentId, locationId);
  const { toast } = useToast();
  const [publishingVersion, setPublishingVersion] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draftingFrom, setDraftingFrom] = useState<number | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(versions ?? [])]
      .sort((a, b) => b.version - a.version)
      .filter((v) => {
        if (filter === "published" && !v.is_published) return false;
        if (filter === "drafts" && v.is_published) return false;
        if (!q) return true;
        return (
          `v${v.version}`.includes(q) ||
          (v.version_title ?? "").toLowerCase().includes(q) ||
          (v.version_description ?? "").toLowerCase().includes(q)
        );
      });
  }, [versions, search, filter]);

  const startPublish = (version: number) => {
    setPublishingVersion(version);
    setTitle("");
    setDescription("");
  };

  const confirmPublish = async () => {
    if (publishingVersion === null) return;
    try {
      await publishMut.mutateAsync({
        version: publishingVersion,
        versionTitle: title.trim() || undefined,
        versionDescription: description.trim() || undefined,
      });
      toast(`Version ${publishingVersion} published`, "success");
      setPublishingVersion(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to publish version", "error");
    }
  };

  const createDraft = async (baseVersion: number) => {
    setDraftingFrom(baseVersion);
    try {
      await draftMut.mutateAsync(baseVersion);
      toast(`New draft created from version ${baseVersion}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create draft version", "error");
    } finally {
      setDraftingFrom(null);
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "drafts", label: "Drafts" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[460px] h-full bg-white shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center gap-3 px-5 h-14 border-b border-gray-200 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <GitBranch className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold text-gray-900 leading-tight">
              Version history
            </h2>
            <p className="text-[11px] text-gray-500">Currently editing v{currentVersion}</p>
          </div>
          <Button
            size="sm"
            icon={Plus}
            loading={draftingFrom === currentVersion}
            disabled={draftMut.isPending}
            onClick={() => createDraft(currentVersion)}
          >
            New version
          </Button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 space-y-2.5 shrink-0">
          <SearchInput
            placeholder="Search by version, title or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="inline-flex p-0.5 rounded-lg bg-gray-100">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1 text-[12px] font-medium rounded-md transition-all",
                  filter === f.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 bg-gray-50/60">
          {isLoading && (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] rounded-xl bg-white border border-gray-200 animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm font-medium text-red-700">Could not load versions</p>
              <p className="text-xs text-red-600 mt-1">
                {error instanceof Error ? error.message : "Please try again"}
              </p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && (
            <ol className="relative space-y-3 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-px before:bg-gray-200">
              {visible.map((v) => (
                <VersionRow
                  key={v.version}
                  v={v}
                  isCurrent={v.version === currentVersion}
                  isPublishing={publishingVersion === v.version}
                  onPublish={() => startPublish(v.version)}
                  onDraft={() => createDraft(v.version)}
                  drafting={draftingFrom === v.version}
                  draftDisabled={draftMut.isPending}
                >
                  {publishingVersion === v.version && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      <Input
                        type="text"
                        placeholder="Version title (optional)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      <Textarea
                        placeholder="What changed in this version? (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          icon={Rocket}
                          loading={publishMut.isPending}
                          onClick={confirmPublish}
                        >
                          Confirm publish
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPublishingVersion(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </VersionRow>
              ))}
            </ol>
          )}

          {!isLoading && !error && visible.length === 0 && (
            <p className="text-[13px] text-gray-500 text-center py-10">
              {versions && versions.length > 0
                ? "No versions match your search"
                : "No versions found"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionRow({
  v,
  isCurrent,
  isPublishing,
  onPublish,
  onDraft,
  drafting,
  draftDisabled,
  children,
}: {
  v: AgentVersion;
  isCurrent: boolean;
  isPublishing: boolean;
  onPublish: () => void;
  onDraft: () => void;
  drafting: boolean;
  draftDisabled: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="relative pl-8">
      <span
        className={cn(
          "absolute left-0 top-3.5 w-[23px] h-[23px] rounded-full border-2 bg-white flex items-center justify-center",
          v.is_published ? "border-emerald-400" : "border-gray-300",
          isCurrent && "border-brand-500"
        )}
      >
        {v.is_published ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        )}
      </span>
      <div
        className={cn(
          "rounded-xl border bg-white p-3.5 shadow-sm",
          isCurrent ? "border-brand-300 ring-1 ring-brand-500/10" : "border-gray-200",
          isPublishing && "ring-2 ring-brand-500/20"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-semibold text-gray-900">Version {v.version}</span>
              {v.is_published && <Badge variant="success">Published</Badge>}
              {isCurrent && <Badge variant="brand">Current</Badge>}
              {!v.is_published && !isCurrent && <Badge variant="neutral">Draft</Badge>}
            </div>
            {v.version_title && (
              <p className="text-[12px] font-medium text-gray-700 mt-1 truncate">
                {v.version_title}
              </p>
            )}
            {v.version_description && (
              <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">
                {v.version_description}
              </p>
            )}
            <p className="text-[11px] text-gray-400 mt-1.5 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(v.last_modification_timestamp)}
              {v.base_version !== null && v.base_version !== undefined && (
                <span className="ml-1.5">from v{v.base_version}</span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {!v.is_published && (
              <Button size="sm" icon={Rocket} onClick={onPublish} disabled={isPublishing}>
                Publish
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              icon={Copy}
              loading={drafting}
              disabled={draftDisabled}
              onClick={onDraft}
              title="Create a new draft starting from this version"
            >
              Use as base
            </Button>
          </div>
        </div>
        {children}
      </div>
    </li>
  );
}
