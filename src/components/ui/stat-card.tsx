"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  sparkData,
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: number;
  trendLabel?: string;
  sparkData?: number[];
  className?: string;
}) {
  const trendDir = trend === undefined ? null : trend > 0 ? "up" : trend < 0 ? "down" : "flat";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm",
        "transition-all duration-200 hover:shadow-md hover:border-gray-300",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-gray-400" />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-semibold",
                  trendDir === "up" && "text-emerald-600",
                  trendDir === "down" && "text-red-500",
                  trendDir === "flat" && "text-gray-400"
                )}
              >
                {trendDir === "up" && <TrendingUp className="w-3 h-3" />}
                {trendDir === "down" && <TrendingDown className="w-3 h-3" />}
                {trendDir === "flat" && <Minus className="w-3 h-3" />}
                {trend > 0 ? "+" : ""}
                {trend}%
              </span>
              {trendLabel && (
                <span className="text-[11px] text-gray-400">{trendLabel}</span>
              )}
            </div>
          )}
        </div>

        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} trend={trendDir} />
        )}
      </div>
    </div>
  );
}

function Sparkline({
  data,
  trend,
}: {
  data: number[];
  trend: "up" | "down" | "flat" | null;
}) {
  const w = 80;
  const h = 32;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  });

  const lineColor =
    trend === "up"
      ? "rgb(16,185,129)"
      : trend === "down"
        ? "rgb(239,68,68)"
        : "rgb(156,163,175)";

  const fillColor =
    trend === "up"
      ? "rgba(16,185,129,0.08)"
      : trend === "down"
        ? "rgba(239,68,68,0.08)"
        : "rgba(156,163,175,0.08)";

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];

  return (
    <svg width={w} height={h} className="shrink-0">
      <defs>
        <linearGradient id={`spark-fill-${trend}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <polygon
        points={`${firstPoint} ${points.join(" ")} ${lastPoint?.split(",")[0]},${h} ${firstPoint?.split(",")[0]},${h}`}
        fill={`url(#spark-fill-${trend})`}
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
