"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const SIZE = 160;
const THICKNESS = 26;
const GAP_PX = 2;

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

export function DonutChart({
  segments,
  emptyMessage = "No data for this range",
}: {
  segments: DonutSegment[];
  emptyMessage?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const nonZero = segments.filter((s) => s.value > 0);

  if (total === 0 || nonZero.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div
          className="rounded-full border-[14px] border-gray-100"
          style={{ width: SIZE, height: SIZE }}
        />
        <p className="text-[12px] text-gray-400 mt-4">{emptyMessage}</p>
      </div>
    );
  }

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE / 2 - THICKNESS / 2;
  const halfGapAngle = GAP_PX / r;

  const arcs = segments.reduce<
    (DonutSegment & { start: number; end: number; span: number; rawEnd: number })[]
  >((acc, seg) => {
    const prevEnd = acc.length > 0 ? acc[acc.length - 1].rawEnd : -Math.PI / 2;
    const span = (seg.value / total) * Math.PI * 2;
    const end = prevEnd + span;
    const inset = span > halfGapAngle * 2 ? halfGapAngle : 0;
    acc.push({ ...seg, start: prevEnd + inset, end: end - inset, span, rawEnd: end });
    return acc;
  }, []);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="relative flex items-center justify-center py-2"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {arcs.map((arc, i) =>
            arc.value > 0 ? (
              <g key={arc.label}>
                {/* wider transparent hit target */}
                <path
                  d={arcPath(cx, cy, r, arc.start, arc.end)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={THICKNESS + 16}
                  onMouseEnter={() => setHoverIndex(i)}
                  className="cursor-pointer"
                />
                <path
                  d={arcPath(cx, cy, r, arc.start, arc.end)}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={hoverIndex === i ? THICKNESS + 4 : THICKNESS}
                  style={{ transition: "stroke-width 120ms ease" }}
                  pointerEvents="none"
                />
              </g>
            ) : null
          )}
        </svg>

        {hoverIndex !== null && mousePos && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white rounded-md px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap z-10"
            style={{
              left: mousePos.x,
              top: mousePos.y - 12,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="font-semibold">
              {arcs[hoverIndex].value.toLocaleString()} (
              {((arcs[hoverIndex].value / total) * 100).toFixed(1)}%)
            </div>
            <div className="text-gray-300">{arcs[hoverIndex].label}</div>
          </div>
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {segments.map((seg, i) => (
          <li
            key={seg.label}
            className="flex items-center gap-2 text-[12px]"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-[3px] shrink-0 transition-transform",
                hoverIndex === i && "scale-125"
              )}
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-gray-600 truncate flex-1 min-w-0">{seg.label}</span>
            <span className="text-gray-900 font-medium shrink-0">
              {seg.value.toLocaleString()}
              <span className="text-gray-400 font-normal ml-1">
                ({total > 0 ? ((seg.value / total) * 100).toFixed(1) : 0}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
