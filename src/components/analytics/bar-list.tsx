"use client";

import { cn } from "@/lib/utils";

export interface BarListItem {
  label: string;
  value: number;
  badge?: { text: string; tone: "good" | "warning" | "critical" | "neutral" };
}

const BADGE_STYLES: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  critical: "bg-red-50 text-red-600",
  neutral: "bg-gray-100 text-gray-500",
};

export function BarList({
  items,
  color = "#2a78d6",
  formatValue = (v: number) => String(v),
  emptyMessage = "No data for this range",
}: {
  items: BarListItem[];
  color?: string;
  formatValue?: (v: number) => string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-gray-400">{emptyMessage}</div>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-3.5">
      {items.map((item) => {
        const pct = Math.max((item.value / max) * 100, 2);
        return (
          <li key={item.label} className="group">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[12px] text-gray-700 truncate">{item.label}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                {item.badge && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      BADGE_STYLES[item.badge.tone]
                    )}
                  >
                    {item.badge.text}
                  </span>
                )}
                <span className="text-[12px] font-medium text-gray-900">
                  {formatValue(item.value)}
                </span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 group-hover:brightness-110"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
