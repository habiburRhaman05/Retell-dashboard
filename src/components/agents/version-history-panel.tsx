"use client";

import { useState } from "react";
import { X, Rocket, Loader2, Clock } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { useAgentVersions, usePublishVersion } from "@/hooks/use-agent-versions";
import { useToast } from "@/components/layout/toast";

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
  const { data: versions, isLoading, error } = useAgentVersions(agentId, locationId);
  const publishMut = usePublishVersion(agentId, locationId);
  const { toast } = useToast();
  const [publishingVersion, setPublishingVersion] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Version History</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[200px]">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm text-red-600">
                {error instanceof Error ? error.message : "Failed to load versions"}
              </p>
            </div>
          )}

          {!isLoading && !error && versions && (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.version}>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg border",
                      v.version === currentVersion
                        ? "border-cyan-300 bg-cyan-50/40"
                        : "border-gray-200"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-gray-800">
                          Version {v.version}
                        </span>
                        {v.is_published && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                            Published
                          </span>
                        )}
                        {v.version === currentVersion && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-200">
                            Current
                          </span>
                        )}
                      </div>
                      {v.version_title && (
                        <p className="text-[12px] text-gray-600 mt-0.5 truncate">
                          {v.version_title}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-0.5 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(v.last_modification_timestamp)}
                      </p>
                    </div>
                    {!v.is_published && (
                      <button
                        onClick={() => startPublish(v.version)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium hover:bg-gray-200 transition-colors shrink-0"
                      >
                        <Rocket className="w-3 h-3" />
                        Publish
                      </button>
                    )}
                  </div>

                  {publishingVersion === v.version && (
                    <div className="mt-2 px-3.5 py-3 rounded-lg border border-cyan-200 bg-cyan-50/30 space-y-2">
                      <input
                        type="text"
                        placeholder="Version title (optional)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                      />
                      <textarea
                        placeholder="What changed in this version? (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={confirmPublish}
                          disabled={publishMut.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-[12px] font-medium hover:bg-cyan-600 disabled:opacity-50 transition-colors"
                        >
                          {publishMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                          Confirm Publish
                        </button>
                        <button
                          onClick={() => setPublishingVersion(null)}
                          className="px-3 py-1.5 rounded-md text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {versions.length === 0 && (
                <p className="text-[13px] text-gray-400 text-center py-8">
                  No versions found
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
