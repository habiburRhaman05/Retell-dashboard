"use client";

import Link from "next/link";
import type { RetellAgent } from "@/types/retell";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Volume2,
  Globe,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const ACCENT_COLORS = [
  "from-brand-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-indigo-400 to-blue-600",
  "from-fuchsia-400 to-purple-600",
  "from-sky-400 to-brand-500",
];

function getAccentColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function getVoiceLabel(voiceId: string) {
  return voiceId
    ?.replace(/^(retell|cartesia|minimax|11labs|fish_audio|openai|inworld)-/, "")
    || "Unknown";
}

export function AgentCard({
  agent,
  locationId,
  viewMode,
  onDelete,
}: {
  agent: RetellAgent;
  locationId: string;
  viewMode: "grid" | "list";
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accent = getAccentColor(agent.agent_id);

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
      <div className="flex items-center gap-4 px-4 py-3.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all group">
        <div
          className={cn(
            "w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0",
            accent
          )}
        >
          {(agent.agent_name || "U")[0].toUpperCase()}
        </div>

        <Link
          href={`/retell/${locationId}/agents/${agent.agent_id}`}
          className="flex-1 min-w-0 flex items-center gap-4"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {agent.agent_name || "Unnamed Agent"}
              </p>
              <StatusBadge published={agent.is_published} />
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {agent.agent_id.slice(0, 24)}...
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-5 text-xs text-gray-500 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-gray-400" />
              {getVoiceLabel(agent.voice_id)}
            </span>
            {agent.language && (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                {agent.language}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {timeAgo(agent.last_modification_timestamp)}
            </span>
          </div>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 rounded-md hover:bg-gray-200/60 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          {menuOpen && (
            <DropdownMenu
              agentId={agent.agent_id}
              locationId={locationId}
              onDelete={onDelete}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all group">
      <Link
        href={`/retell/${locationId}/agents/${agent.agent_id}`}
        className="block p-5"
      >
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold shrink-0",
              accent
            )}
          >
            {(agent.agent_name || "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-gray-900 truncate">
              {agent.agent_name || "Unnamed Agent"}
            </h3>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
              {agent.agent_id.slice(0, 22)}...
            </p>
          </div>
        </div>

        <div className="space-y-2.5 mb-4">
          <InfoRow icon={Volume2} label="Voice" value={getVoiceLabel(agent.voice_id)} />
          {agent.language && (
            <InfoRow icon={Globe} label="Language" value={agent.language} />
          )}
          <InfoRow
            icon={Clock}
            label="Modified"
            value={timeAgo(agent.last_modification_timestamp)}
          />
        </div>

        <div className="flex items-center justify-between pt-3.5 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <StatusBadge published={agent.is_published} />
            <span className="text-[11px] text-gray-400">v{agent.version}</span>
          </div>
          <span className="text-xs text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
            View Details <ExternalLink className="w-3 h-3" />
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
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
        {menuOpen && (
          <DropdownMenu
            agentId={agent.agent_id}
            locationId={locationId}
            onDelete={onDelete}
            onClose={() => setMenuOpen(false)}
          />
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

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
        published
          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
          : "bg-amber-50 text-amber-600 border border-amber-200"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          published ? "bg-emerald-500" : "bg-amber-500"
        )}
      />
      {published ? "Published" : "Draft"}
    </span>
  );
}

function DropdownMenu({
  agentId,
  locationId,
  onDelete,
  onClose,
}: {
  agentId: string;
  locationId: string;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-20">
      <Link
        href={`/retell/${locationId}/agents/${agentId}/edit`}
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5 text-gray-400" />
        Edit
      </Link>
      <button
        onClick={() => {
          onClose();
          onDelete();
        }}
        className="flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors w-full text-left"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}
