"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  start: number;
  end: number;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function presetRange(days: number, label: string): DateRange {
  const end = Date.now();
  return { start: end - days * DAY_MS, end, label };
}

function monthToDateRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return { start, end: Date.now(), label: "Month to date" };
}

const PRESETS: DateRange[] = [
  { start: startOfToday(), end: Date.now(), label: "Today" },
  presetRange(7, "Last 7 days"),
  presetRange(30, "Last 30 days"),
  presetRange(90, "Last 90 days"),
  monthToDateRange(),
];

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart).getTime();
    const end = new Date(customEnd).getTime() + DAY_MS - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) return;
    onChange({ start, end, label: "Custom range" });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400" />
        {value.label}
        <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
          <div className="py-1">
            {PRESETS.map((preset) => {
              const selected = preset.label === value.label;
              return (
                <button
                  key={preset.label}
                  onClick={() => {
                    onChange(preset);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3.5 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {preset.label}
                  {selected && <Check className="w-4 h-4 text-brand-500" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-100 px-3.5 py-3">
            <p className="text-[11px] text-gray-400 mb-2">Custom range</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700"
              />
              <span className="text-gray-300 text-[12px]">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700"
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customStart || !customEnd}
              className="mt-2 w-full px-3 py-1.5 rounded-md bg-gray-900 text-white text-[12px] font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
