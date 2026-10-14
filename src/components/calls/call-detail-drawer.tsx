"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useCallDetail } from "@/hooks/use-calls";
import type { RetellCall, TranscriptUtterance } from "@/types/retell";

type Tab = "transcription" | "data" | "logs";

function formatDateTime(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

function formatDuration(ms?: number): string {
  if (ms == null) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCost(cents?: number): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(3)}`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard access can be blocked; not worth surfacing an error for a copy icon
        }
      }}
      aria-label="Copy"
      className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => setError(true));
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
      />
      <button
        onClick={toggle}
        disabled={error}
        aria-label={playing ? "Pause" : "Play"}
        className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center shrink-0 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      {error ? (
        <p className="text-xs text-red-600">Could not load the recording.</p>
      ) : (
        <>
          <span className="text-[11px] text-gray-500 font-mono w-9">{fmt(current)}</span>
          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500"
              style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-[11px] text-gray-500 font-mono w-9">{fmt(duration)}</span>
        </>
      )}
      <a
        href={src}
        download
        aria-label="Download recording"
        className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function Transcription({ call }: { call: RetellCall }) {
  const turns = call.transcript_object as TranscriptUtterance[] | undefined;
  if (turns && turns.length > 0) {
    return (
      <div className="space-y-3">
        {turns.map((turn, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-400 capitalize">{turn.role}</span>
            <p className="text-[13px] text-gray-800 bg-gray-50 rounded-lg px-3 py-2 max-w-xl">
              {turn.content}
            </p>
          </div>
        ))}
      </div>
    );
  }
  if (call.transcript) {
    return <p className="text-[13px] text-gray-700 whitespace-pre-wrap">{call.transcript}</p>;
  }
  return <p className="text-sm text-gray-400 text-center py-8">No transcript available for this call.</p>;
}

function DataTab({ call }: { call: RetellCall }) {
  const sections: { title: string; data: Record<string, unknown> | undefined }[] = [
    { title: "Dynamic variables", data: call.retell_llm_dynamic_variables },
    { title: "Collected variables", data: call.collected_dynamic_variables },
    { title: "Metadata", data: call.metadata },
    { title: "Custom analysis data", data: call.call_analysis?.custom_analysis_data },
  ].filter((s) => s.data && Object.keys(s.data).length > 0);

  if (sections.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No data attached to this call.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5">{s.title}</p>
          <pre className="text-[12px] text-gray-700 bg-gray-50 rounded-lg p-3 overflow-x-auto font-mono">
            {JSON.stringify(s.data, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

function DetailLogs({ lines }: { lines: string[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No detail logs available for this call.</p>;
  }
  return (
    <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
      {lines.map((line, i) => (
        <p key={i} className="text-[11px] font-mono text-gray-300 whitespace-pre leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  );
}

export function CallDetailDrawer({ callId, onClose }: { callId: string; onClose: () => void }) {
  const { data, isLoading, error } = useCallDetail(callId);
  const [tab, setTab] = useState<Tab>("transcription");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const call = data?.call;
  const analysis = call?.call_analysis;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Call detail"
        className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-slide-up overflow-y-auto"
      >
        <div className="flex items-center justify-end px-6 pt-4 shrink-0">
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <p className="text-sm">Loading call...</p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm font-medium text-red-600">Could not load this call</p>
            <p className="text-xs text-gray-500 max-w-md">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
          </div>
        )}

        {call && (
          <div className="px-6 pb-8 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {formatDateTime(call.start_timestamp)} · {call.call_type}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-[12px] text-gray-500">
                <span>Agent: {call.agent_name || call.agent_id}</span>
                <CopyButton value={call.agent_id} />
                {call.agent_version != null && (
                  <span className="text-gray-400">· Version: {call.agent_version}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-gray-500">
                <span>Call ID: {call.call_id}</span>
                <CopyButton value={call.call_id} />
              </div>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Duration: {formatDuration(call.duration_ms)} · Cost: {formatCost(call.call_cost?.combined_cost)}
              </p>
            </div>

            {call.recording_url && <AudioPlayer src={call.recording_url} />}

            <div>
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Conversation Analysis</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                <span className="text-gray-500">Call Successful</span>
                <Badge
                  variant={analysis?.call_successful === true ? "success" : analysis?.call_successful === false ? "error" : "neutral"}
                  dot
                  className="w-fit"
                >
                  {analysis?.call_successful === true ? "Successful" : analysis?.call_successful === false ? "Unsuccessful" : "Pending"}
                </Badge>

                <span className="text-gray-500">Call Status</span>
                <Badge variant="neutral" dot className="w-fit">{call.call_status}</Badge>

                <span className="text-gray-500">User Sentiment</span>
                <Badge variant="info" dot className="w-fit">{analysis?.user_sentiment ?? "Unknown"}</Badge>

                <span className="text-gray-500">Disconnection Reason</span>
                {call.disconnection_reason ? (
                  <Badge variant="neutral" dot className="w-fit">{call.disconnection_reason}</Badge>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </div>
            </div>

            {analysis?.call_summary && (
              <div>
                <p className="text-[12px] font-semibold text-gray-700 mb-1.5">Summary</p>
                <p className="text-[13px] text-gray-700">{analysis.call_summary}</p>
              </div>
            )}

            <div>
              <div className="flex items-center gap-5 border-b border-gray-200 mb-4">
                {([
                  ["transcription", "Transcription"],
                  ["data", "Data"],
                  ["logs", "Detail Logs"],
                ] as [Tab, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "pb-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                      tab === key
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "transcription" && <Transcription call={call} />}
              {tab === "data" && <DataTab call={call} />}
              {tab === "logs" && <DetailLogs lines={data?.logLines ?? []} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
