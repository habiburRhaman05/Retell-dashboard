"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const VB_HEIGHT = 260;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const DEFAULT_WIDTH = 600;

function niceTicks(rawMax: number, tickCount = 4, integersOnly = false): number[] {
  if (rawMax <= 0) return integersOnly ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4];
  const roughStep = rawMax / tickCount;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / mag;
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  let step = niceNorm * mag;
  if (integersOnly) step = Math.max(1, Math.round(step));
  const max = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Measures the live rendered width of a container so the SVG's viewBox can
 * match it 1:1 — without this, `preserveAspectRatio="none"` stretching a
 * fixed-width viewBox non-uniformly distorts text glyphs and strokes. */
function useMeasuredWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export function LineAreaChart({
  data,
  color,
  seriesLabel,
  formatValue = (v: number) => String(v),
  emptyMessage = "No data for this range",
  integersOnly = false,
}: {
  data: { date: string; value: number }[];
  color: string;
  seriesLabel: string;
  formatValue?: (v: number) => string;
  emptyMessage?: string;
  integersOnly?: boolean;
}) {
  const [containerRef, width] = useMeasuredWidth<HTMLDivElement>(DEFAULT_WIDTH);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const rawMax = Math.max(0, ...data.map((d) => d.value));
  const ticks = useMemo(() => niceTicks(rawMax, 4, integersOnly), [rawMax, integersOnly]);
  const maxValue = ticks[ticks.length - 1] || 1;

  const plotWidth = width - PAD_LEFT - PAD_RIGHT;
  const plotHeight = VB_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    ...d,
    x: PAD_LEFT + i * xStep,
    y: PAD_TOP + plotHeight - (d.value / maxValue) * plotHeight,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const baseline = PAD_TOP + plotHeight;
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x.toFixed(2)},${baseline} L${points[0].x.toFixed(2)},${baseline} Z`
      : "";

  // Space labels so neighboring text can't collide — cap how many fit based
  // on the measured container width rather than a fixed count.
  const minLabelSpacing = 82; // comfortable width for "Oct 6" .. "Sep 30"
  const maxLabels = Math.max(2, Math.floor((width || DEFAULT_WIDTH) / minLabelSpacing));
  const xLabelStep = Math.max(1, Math.ceil(data.length / maxLabels));
  const xLabelIndices = data
    .map((_, i) => i)
    .filter((i) => i % xLabelStep === 0 || i === data.length - 1);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (points.length === 0 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - xPx);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  if (data.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-[13px] text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipFlipped = hovered ? hovered.x > width * 0.7 : false;

  return (
    <div
      ref={containerRef}
      className="relative select-none"
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${VB_HEIGHT}`}
        width="100%"
        height={VB_HEIGHT}
        role="img"
        aria-label={seriesLabel}
      >
        {/* gridlines + y labels */}
        {ticks.map((t) => {
          const y = PAD_TOP + plotHeight - (t / maxValue) * plotHeight;
          return (
            <g key={t}>
              <line x1={PAD_LEFT} y1={y} x2={width - PAD_RIGHT} y2={y} stroke="#e1e0d9" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#898781">
                {t >= 1000 ? `${(t / 1000).toFixed(t % 1000 === 0 ? 0 : 1)}k` : t}
              </text>
            </g>
          );
        })}

        {/* x labels */}
        {xLabelIndices.map((i) => (
          <text
            key={i}
            x={points[i].x}
            y={VB_HEIGHT - 8}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            fontSize={10}
            fill="#898781"
          >
            {formatDateLabel(data[i].date)}
          </text>
        ))}

        {/* area + line */}
        <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* crosshair */}
        {hovered && (
          <>
            <line
              x1={hovered.x}
              y1={PAD_TOP}
              x2={hovered.x}
              y2={baseline}
              stroke="#c3c2b7"
              strokeWidth={1}
            />
            <circle cx={hovered.x} cy={hovered.y} r={5} fill={color} stroke="#fcfcfb" strokeWidth={2} />
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="absolute top-2 pointer-events-none bg-gray-900 text-white rounded-md px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap"
          style={{
            left: hovered.x,
            transform: tooltipFlipped ? "translateX(-100%)" : "translateX(0)",
            marginLeft: tooltipFlipped ? -8 : 8,
          }}
        >
          <div className="font-semibold">{formatValue(hovered.value)}</div>
          <div className="text-gray-300">{formatDateLabel(hovered.date)}</div>
        </div>
      )}
    </div>
  );
}
