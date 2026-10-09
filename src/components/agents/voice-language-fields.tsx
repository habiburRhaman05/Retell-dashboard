"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoices } from "@/hooks/use-voices";
import { VoiceAvatar, VoicePickerModal } from "./voice-picker-modal";
import {
  LanguageFlag,
  LanguagePickerModal,
  normalizeLanguage,
} from "./language-picker-modal";
import { languagesLabel } from "@/lib/languages";

const triggerClass =
  "flex w-full items-center gap-2.5 h-10 px-3 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-700 transition-all hover:border-gray-300 hover:shadow-sm disabled:opacity-60 text-left";

export function VoiceField({
  value,
  onSave,
  isSaving,
}: {
  value: string;
  onSave: (voiceId: string) => void | boolean | Promise<void | boolean>;
  isSaving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: voices } = useVoices();
  const voice = voices?.find((v) => v.voice_id === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isSaving}
        className={cn(triggerClass, open && "border-brand-400 ring-2 ring-brand-500/20")}
      >
        {isSaving ? (
          <Loader2 className="w-5 h-5 animate-spin text-brand-500 shrink-0" />
        ) : (
          <VoiceAvatar
            voice={voice ?? { voice_name: value || "?", avatar_url: null }}
            className="w-6 h-6 text-[10px] shrink-0"
          />
        )}
        <span className="flex-1 truncate">{voice?.voice_name ?? (value || "Select voice")}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>
      {open && (
        <VoicePickerModal
          value={value}
          isSaving={isSaving}
          onClose={() => setOpen(false)}
          onSave={async (id) => {
            const ok = id !== value ? await onSave(id) : true;
            if (ok !== false) setOpen(false);
          }}
        />
      )}
    </>
  );
}

export function LanguageField({
  value,
  onSave,
  isSaving,
}: {
  value: string | string[] | null | undefined;
  onSave: (value: string | string[]) => void | boolean | Promise<void | boolean>;
  isSaving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const codes = normalizeLanguage(value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isSaving}
        className={cn(triggerClass, open && "border-brand-400 ring-2 ring-brand-500/20")}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin text-brand-500 shrink-0" />
        ) : codes[0] ? (
          <LanguageFlag code={codes[0]} className="w-5 h-3.5" />
        ) : (
          <Globe className="w-4 h-4 text-brand-500 shrink-0" />
        )}
        <span className="flex-1 truncate">{languagesLabel(codes)}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>
      {open && (
        <LanguagePickerModal
          value={codes}
          isSaving={isSaving}
          onClose={() => setOpen(false)}
          onSave={async (v) => {
            const same = JSON.stringify(normalizeLanguage(v)) === JSON.stringify(codes);
            const ok = !same ? await onSave(v) : true;
            if (ok !== false) setOpen(false);
          }}
        />
      )}
    </>
  );
}
