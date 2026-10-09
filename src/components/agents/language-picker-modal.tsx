"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { LANGUAGES, languageFlag, languagesLabel } from "@/lib/languages";

export function LanguageFlag({ code, className }: { code: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const flag = languageFlag(code);
  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-sm bg-gray-100 text-[8px] font-semibold text-gray-500",
          className
        )}
      >
        {code.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${flag}.png`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("rounded-sm object-cover shrink-0", className)}
    />
  );
}

export function normalizeLanguage(value: string | string[] | null | undefined): string[] {
  if (!value) return ["en-US"];
  if (typeof value === "string") return value === "multi" ? ["en-US"] : [value];
  return value.length > 0 ? value : ["en-US"];
}

/** Retell accepts a single locale string, or an array for multilingual agents. */
export function toLanguagePayload(selected: string[]): string | string[] {
  return selected.length === 1 ? selected[0] : selected;
}

export function LanguagePickerModal({
  value,
  onSave,
  onClose,
  isSaving,
}: {
  value: string | string[] | null | undefined;
  onSave: (value: string | string[]) => void | Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}) {
  const initial = normalizeLanguage(value);
  const [multi, setMulti] = useState(initial.length > 1);
  const [selected, setSelected] = useState<string[]>(initial);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        (l.region ?? "").toLowerCase().includes(q) ||
        l.value.toLowerCase().includes(q)
    );
  }, [search]);

  const toggle = (code: string) => {
    if (!multi) {
      setSelected([code]);
      return;
    }
    setSelected((prev) => {
      if (prev.includes(code)) {
        // Always keep at least one language selected.
        return prev.length === 1 ? prev : prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  const switchMulti = (next: boolean) => {
    setMulti(next);
    if (!next) setSelected((prev) => [prev[0] ?? "en-US"]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select language"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md h-[min(640px,90vh)] flex flex-col animate-slide-up"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Speech language</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => switchMulti(!multi)}
              aria-pressed={multi}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                multi ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              Multi-select
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-3 shrink-0 space-y-2">
          <SearchInput
            placeholder="Search languages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {multi && (
            <p className="text-[11px] text-gray-500">
              The agent will detect and switch between the selected languages.
            </p>
          )}
        </div>

        <ul className="flex-1 overflow-y-auto px-2 pb-2 min-h-0 border-t border-gray-100 pt-2">
          {filtered.map((l) => {
            const isSel = selected.includes(l.value);
            return (
              <li key={l.value}>
                <button
                  onClick={() => toggle(l.value)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                    isSel ? "bg-brand-50/60" : "hover:bg-gray-50"
                  )}
                >
                  <LanguageFlag code={l.value} className="w-6 h-4" />
                  <span className="text-[13px] text-gray-900">{l.label}</span>
                  {l.region && <span className="text-[12px] text-gray-400">({l.region})</span>}
                  <span className="ml-auto flex items-center">
                    {multi ? (
                      <span
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center",
                          isSel ? "bg-brand-500 border-brand-500" : "border-gray-300"
                        )}
                      >
                        {isSel && <Check className="w-3 h-3 text-white" />}
                      </span>
                    ) : (
                      isSel && <Check className="w-4 h-4 text-brand-500" />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="py-12 text-center text-sm text-gray-500">No languages match</li>
          )}
        </ul>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 shrink-0">
          <p className="text-[12px] text-gray-500 truncate">{languagesLabel(selected)}</p>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={isSaving}
              disabled={isSaving || selected.length === 0}
              onClick={() => onSave(toLanguagePayload(selected))}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
