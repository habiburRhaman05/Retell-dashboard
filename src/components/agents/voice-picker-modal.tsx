"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, Pause, Check, Loader2, AlertCircle, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { useVoices } from "@/hooks/use-voices";
import type { RetellVoice } from "@/types/retell";

export const PROVIDER_LABELS: Record<string, string> = {
  platform: "Retell",
  elevenlabs: "ElevenLabs",
  cartesia: "Cartesia",
  minimax: "MiniMax",
  fish_audio: "Fish Audio",
  inworld: "Inworld",
  openai: "OpenAI",
};

function providerLabel(p: string) {
  return PROVIDER_LABELS[p] ?? p;
}

export function VoiceAvatar({
  voice,
  className,
}: {
  voice?: Pick<RetellVoice, "voice_name" | "avatar_url"> | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const name = voice?.voice_name ?? "?";
  // Initials always render underneath; the photo fades in on top once it has
  // actually loaded, so a slow or broken image never leaves an empty circle.
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span className="w-full h-full rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-semibold">
        {name.charAt(0).toUpperCase()}
      </span>
      {voice?.avatar_url && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={voice.avatar_url}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 w-full h-full rounded-full object-cover bg-white transition-opacity",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </span>
  );
}

function voiceMeta(v: RetellVoice) {
  return [v.accent, v.age, providerLabel(v.provider)].filter(Boolean).join(" · ");
}

function VoiceCard({
  v,
  isSelected,
  isPlaying,
  onSelect,
  onTogglePlay,
}: {
  v: RetellVoice;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onTogglePlay: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
        isSelected
          ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/20"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      )}
    >
      <VoiceAvatar voice={v} className="w-10 h-10 text-sm shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-gray-900 truncate flex items-center gap-1.5">
          {v.voice_name}
          {isSelected && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
        </p>
        <p className="text-[11px] text-gray-500 truncate">{voiceMeta(v)}</p>
        <p className="text-[10px] text-gray-400 truncate font-mono">ID: {v.voice_id}</p>
      </div>
      <button
        type="button"
        aria-label={isPlaying ? `Pause ${v.voice_name}` : `Play ${v.voice_name}`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        className={cn(
          "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors",
          isPlaying
            ? "border-brand-500 bg-brand-500 text-white"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
        )}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function VoicePickerModal({
  value,
  onSave,
  onClose,
  isSaving,
}: {
  value: string;
  onSave: (voiceId: string) => void | Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}) {
  const { data: voices, isLoading, error, refetch } = useVoices();
  const [selected, setSelected] = useState(value);
  const [group, setGroup] = useState<"platform" | "custom" | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [gender, setGender] = useState("");
  const [accent, setAccent] = useState("");
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = "";
    }
    audioRef.current = null;
    setPlayingId(null);
  };

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = "";
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedVoice = useMemo(
    () => voices?.find((v) => v.voice_id === selected),
    [voices, selected]
  );

  const customProviders = useMemo(() => {
    const set = new Set<string>();
    voices?.forEach((v) => v.provider !== "platform" && set.add(v.provider));
    return [...set].sort((a, b) => providerLabel(a).localeCompare(providerLabel(b)));
  }, [voices]);

  // Default tab/provider come from the voice that is currently selected,
  // computed during render so there is no flash of the wrong tab.
  const initialVoice = voices?.find((v) => v.voice_id === value);
  const activeGroup: "platform" | "custom" =
    group ?? (initialVoice && initialVoice.provider !== "platform" ? "custom" : "platform");
  const activeProvider =
    activeGroup === "custom"
      ? provider && customProviders.includes(provider)
        ? provider
        : initialVoice && customProviders.includes(initialVoice.provider)
        ? initialVoice.provider
        : customProviders[0] ?? null
      : "platform";

  const inScope = useMemo(
    () => (voices ?? []).filter((v) => v.provider === activeProvider),
    [voices, activeProvider]
  );

  const accents = useMemo(
    () => [...new Set(inScope.map((v) => v.accent).filter(Boolean) as string[])].sort(),
    [inScope]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inScope.filter((v) => {
      if (gender && v.gender !== gender) return false;
      if (accent && v.accent !== accent) return false;
      if (!q) return true;
      return (
        v.voice_name.toLowerCase().includes(q) ||
        v.voice_id.toLowerCase().includes(q) ||
        (v.accent ?? "").toLowerCase().includes(q)
      );
    });
  }, [inScope, gender, accent, search]);

  const recommended = useMemo(
    () => (!search && !gender && !accent ? inScope.filter((v) => v.recommended) : []),
    [inScope, search, gender, accent]
  );

  const togglePlay = (v: RetellVoice) => {
    setPreviewError(null);
    if (playingId === v.voice_id) {
      stopAudio();
      return;
    }
    if (!v.preview_audio_url) {
      setPreviewError(`No preview available for ${v.voice_name}`);
      return;
    }
    stopAudio();
    const audio = new Audio(v.preview_audio_url);
    audioRef.current = audio;
    setPlayingId(v.voice_id);
    audio.onended = () => setPlayingId((cur) => (cur === v.voice_id ? null : cur));
    audio.onerror = () => {
      setPlayingId((cur) => (cur === v.voice_id ? null : cur));
      setPreviewError(`Could not play the preview for ${v.voice_name}`);
    };
    audio.play().catch(() => {
      setPlayingId((cur) => (cur === v.voice_id ? null : cur));
      setPreviewError(`Could not play the preview for ${v.voice_name}`);
    });
  };

  const tabClass = (active: boolean) =>
    cn(
      "px-1 pb-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
      active
        ? "border-brand-500 text-brand-600"
        : "border-transparent text-gray-500 hover:text-gray-800"
    );

  const selectClass =
    "h-9 px-3 pr-8 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select voice"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[min(760px,92vh)] flex flex-col animate-slide-up"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Select voice</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 pt-3 border-b border-gray-200 flex gap-6 shrink-0">
          <button
            className={tabClass(activeGroup === "platform")}
            onClick={() => {
              setGroup("platform");
              setAccent("");
            }}
          >
            Platform voices
          </button>
          <button
            className={tabClass(activeGroup === "custom")}
            onClick={() => {
              setGroup("custom");
              setAccent("");
            }}
          >
            Custom providers
          </button>
        </div>

        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <p className="text-sm">Loading voices from Retell...</p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm font-medium text-red-600">Could not load voices</p>
            <p className="text-xs text-gray-500 max-w-md">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="px-6 pt-4 space-y-3 shrink-0">
              {activeGroup === "custom" && (
                <div className="flex p-1 rounded-xl bg-gray-100 overflow-x-auto">
                  {customProviders.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setProvider(p);
                        setAccent("");
                      }}
                      className={cn(
                        "flex-1 min-w-[96px] px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all whitespace-nowrap",
                        activeProvider === p
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      {providerLabel(p)}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
                <select
                  aria-label="Accent"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Accent</option>
                  {accents.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <div className="w-full sm:w-72">
                  <SearchInput
                    placeholder="Search voices..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <span className="ml-auto text-[12px] text-gray-400">
                  {filtered.length} voice{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>

              {previewError && (
                <p className="text-[12px] text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {previewError}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {recommended.length > 0 && (
                <div className="mb-5">
                  <p className="text-[12px] font-semibold text-gray-700 mb-2">
                    Recommended voices
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {recommended.map((v) => (
                      <VoiceCard key={`rec-${v.voice_id}`} v={v} isSelected={v.voice_id === selected} isPlaying={playingId === v.voice_id} onSelect={() => setSelected(v.voice_id)} onTogglePlay={() => togglePlay(v)} />
                    ))}
                  </div>
                </div>
              )}

              {filtered.length > 0 ? (
                <>
                  {recommended.length > 0 && (
                    <p className="text-[12px] font-semibold text-gray-700 mb-2">All voices</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((v) => (
                      <VoiceCard key={v.voice_id} v={v} isSelected={v.voice_id === selected} isPlaying={playingId === v.voice_id} onSelect={() => setSelected(v.voice_id)} onTogglePlay={() => togglePlay(v)} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center">
                  <Volume2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No voices match your filters</p>
                  <button
                    className="text-[12px] text-brand-600 hover:underline mt-1"
                    onClick={() => {
                      setSearch("");
                      setGender("");
                      setAccent("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <VoiceAvatar voice={selectedVoice} className="w-9 h-9 text-xs shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate">
                {selectedVoice?.voice_name ?? selected ?? "No voice selected"}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {selectedVoice ? voiceMeta(selectedVoice) : selected}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={isSaving}
              disabled={!selected || isSaving}
              onClick={async () => {
                stopAudio();
                await onSave(selected);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
