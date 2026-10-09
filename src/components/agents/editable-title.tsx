"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Click the name (or the pencil) to rename. Enter or the check saves,
 * Escape or the X cancels. A failed save keeps the editor open. */
export function EditableTitle({
  value,
  placeholder = "Unnamed Agent",
  onSave,
  className,
}: {
  value: string;
  placeholder?: string;
  /** Resolve to false when saving failed. */
  onSave: (name: string) => Promise<boolean>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const start = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    if (saving) return;
    setEditing(false);
    setError(null);
  };

  const commit = async () => {
    if (saving) return;
    const name = draft.trim();
    if (!name) {
      setError("The name cannot be empty");
      return;
    }
    if (name.length > 100) {
      setError("Keep the name under 100 characters");
      return;
    }
    if (name === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onSave(name);
    setSaving(false);
    if (ok) setEditing(false);
    else setError("Could not rename the agent. Try again.");
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        title="Rename"
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-lg -mx-1.5 px-1.5 py-0.5 text-left hover:bg-gray-100 transition-colors min-w-0",
          className
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </button>
    );
  }

  return (
    <div className="min-w-0">
      <div className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          disabled={saving}
          maxLength={120}
          aria-label="Agent name"
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") cancel();
          }}
          className={cn(
            "min-w-[200px] max-w-[420px] rounded-lg border bg-white px-2.5 py-1 text-lg font-semibold text-gray-900 tracking-tight focus:ring-2 focus:ring-brand-500/20",
            error ? "border-red-300" : "border-brand-400"
          )}
        />
        <button
          type="button"
          onClick={() => void commit()}
          disabled={saving}
          aria-label="Save name"
          className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label="Cancel rename"
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-60"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-[12px] text-red-600 mt-1">{error}</p>}
    </div>
  );
}
