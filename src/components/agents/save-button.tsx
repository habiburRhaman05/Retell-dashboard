"use client";

import { Check, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

/** Save button with a change indicator: an amber pulsing dot while there are
 * unsaved changes, a quiet "Saved" state otherwise. */
export function SaveButton({
  dirty,
  saving,
  onClick,
  className,
}: {
  dirty: boolean;
  saving: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty || saving}
      title={dirty ? "Save changes (Ctrl+S)" : "All changes saved"}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 select-none",
        dirty
          ? "bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/25 ring-2 ring-amber-300/70"
          : "border border-gray-200 bg-white text-gray-400",
        saving && "opacity-80 cursor-wait",
        className
      )}
    >
      {saving ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : dirty ? (
        <Save className="w-3.5 h-3.5" />
      ) : (
        <Check className="w-3.5 h-3.5" />
      )}
      <span>{saving ? "Saving..." : dirty ? "Save changes" : "Saved"}</span>
      {dirty && !saving && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3" aria-label="Unsaved changes">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400 border-2 border-white" />
        </span>
      )}
    </button>
  );
}
