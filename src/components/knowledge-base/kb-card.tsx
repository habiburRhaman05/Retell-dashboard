"use client";

import Link from "next/link";
import type { KnowledgeBase } from "@/types/retell";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  MoreVertical,
  Trash2,
  FileText,
  Clock,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const ACCENT_COLORS = [
  "from-brand-500 to-brand-700",
  "from-violet-500 to-purple-700",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
  "from-indigo-500 to-blue-700",
];

function getAccentColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

export function KnowledgeBaseCard({
  kb,
  locationId,
  viewMode,
  onDelete,
}: {
  kb: KnowledgeBase;
  locationId: string;
  viewMode: "grid" | "list";
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accent = getAccentColor(kb.knowledge_base_id);
  const sourceCount = kb.knowledge_base_sources?.length ?? 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  if (viewMode === "list") {
    return (
      <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 hover:shadow-sm transition-all duration-150 group">
        <div
          className={cn(
            "w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm",
            accent
          )}
        >
          {kb.knowledge_base_name[0]?.toUpperCase() || "K"}
        </div>

        <Link
          href={`/retell/${locationId}/knowledge-base/${kb.knowledge_base_id}`}
          className="flex-1 min-w-0 flex items-center gap-4"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                {kb.knowledge_base_name}
              </p>
              <StatusBadge status={kb.status} />
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {kb.knowledge_base_id.slice(0, 24)}...
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-5 text-xs text-gray-500 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              {sourceCount} source{sourceCount !== 1 ? "s" : ""}
            </span>
            {kb.enable_auto_refresh && (
              <span className="inline-flex items-center gap-1.5 text-gray-400">
                <RefreshCw className="w-3.5 h-3.5" />
                Auto-refresh
              </span>
            )}
          </div>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-200/60 transition-all duration-150 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          {menuOpen && (
            <DropdownMenu onDelete={onDelete} onClose={() => setMenuOpen(false)} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 group">
      <Link
        href={`/retell/${locationId}/knowledge-base/${kb.knowledge_base_id}`}
        className="block p-5"
      >
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={cn(
              "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm",
              accent
            )}
          >
            {kb.knowledge_base_name[0]?.toUpperCase() || "K"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-gray-900 truncate group-hover:text-brand-600 transition-colors">
              {kb.knowledge_base_name}
            </h3>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
              {kb.knowledge_base_id.slice(0, 22)}...
            </p>
          </div>
        </div>

        <div className="space-y-2.5 mb-4">
          <InfoRow
            icon={FileText}
            label="Sources"
            value={`${sourceCount} source${sourceCount !== 1 ? "s" : ""}`}
          />
          {kb.enable_auto_refresh && (
            <InfoRow icon={RefreshCw} label="Refresh" value="Daily auto-refresh" />
          )}
          {kb.last_refreshed_timestamp && (
            <InfoRow
              icon={Clock}
              label="Refreshed"
              value={new Date(kb.last_refreshed_timestamp).toLocaleDateString()}
            />
          )}
        </div>

        <div className="flex items-center justify-between pt-3.5 border-t border-gray-100">
          <StatusBadge status={kb.status} />
          <span className="text-xs text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-all duration-150 inline-flex items-center gap-1">
            Open <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </Link>

      <div className="absolute top-4 right-4" ref={menuRef}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-150 opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
        {menuOpen && (
          <DropdownMenu onDelete={onDelete} onClose={() => setMenuOpen(false)} />
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span className="text-gray-400 w-16 shrink-0">{label}</span>
      <span className="text-gray-700 truncate">{value}</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: KnowledgeBase["status"] }) {
  const config = {
    complete: {
      label: "Ready",
      variant: "success" as const,
      icon: null,
    },
    in_progress: {
      label: "Processing",
      variant: "warning" as const,
      icon: Loader2,
    },
    refreshing_in_progress: {
      label: "Refreshing",
      variant: "info" as const,
      icon: Loader2,
    },
    error: {
      label: "Error",
      variant: "error" as const,
      icon: AlertCircle,
    },
  }[status] || {
    label: status,
    variant: "neutral" as const,
    icon: null,
  };

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} dot={!Icon}>
      {Icon && <Icon className="w-2.5 h-2.5 animate-spin" />}
      {config.label}
    </Badge>
  );
}

function DropdownMenu({
  onDelete,
  onClose,
}: {
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-1.5 w-40 rounded-xl border border-gray-200 bg-white shadow-lg py-1.5 z-20 animate-fade-in">
      <button
        onClick={() => {
          onClose();
          onDelete();
        }}
        className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors w-full text-left rounded-lg mx-1"
        style={{ width: "calc(100% - 8px)" }}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}
