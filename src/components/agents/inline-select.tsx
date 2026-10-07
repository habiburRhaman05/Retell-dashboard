"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";

export interface InlineSelectOption {
  value: string;
  label: string;
  group?: string;
}

export function InlineSelect({
  icon: Icon,
  value,
  options,
  searchable = false,
  isSaving = false,
  onSave,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  value: string;
  options: readonly InlineSelectOption[];
  searchable?: boolean;
  isSaving?: boolean;
  onSave: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [wasOpen, setWasOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset the search box exactly when the dropdown transitions to open.
  // adjusted during render per React's guidance, not in an effect.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSearch("");
  }

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });
    };
    updatePosition();
    searchInputRef.current?.focus();

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    // Scrolling the option list itself must not close the dropdown - only
    // reposition (or close, if the trigger button scrolled out of view)
    // when something OUTSIDE the panel scrolls.
    function handleScroll(e: Event) {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
    function handleResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  const currentLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? value,
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, InlineSelectOption[]>();
    for (const opt of filtered) {
      const key = opt.group ?? "";
      const arr = groups.get(key) ?? [];
      arr.push(opt);
      groups.set(key, arr);
    }
    return [...groups.entries()];
  }, [filtered]);

  const handleSelect = (v: string) => {
    onSave(v);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        disabled={isSaving}
        className={cn(
          "flex w-full items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-700 transition-all",
          "hover:border-gray-300 hover:shadow-sm disabled:opacity-60",
          open && "border-brand-400 ring-2 ring-brand-500/20"
        )}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-brand-500" />
        ) : (
          Icon && <Icon className="w-4 h-4 shrink-0 text-brand-500" />
        )}
        <span className="flex-1 text-left truncate">{currentLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: position.top, left: position.left }}
            className="w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-[100] overflow-hidden"
          >
            {searchable && (
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-2 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto py-1">
              {grouped.length === 0 && (
                <p className="px-3 py-3 text-[12px] text-gray-400 text-center">No matches</p>
              )}
              {grouped.map(([group, items]) => (
                <div key={group || "_"}>
                  {group && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      {group}
                    </p>
                  )}
                  {items.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-50 transition-colors",
                        opt.value === value ? "text-brand-600 font-medium" : "text-gray-700"
                      )}
                    >
                      {opt.label}
                      {opt.value === value && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
