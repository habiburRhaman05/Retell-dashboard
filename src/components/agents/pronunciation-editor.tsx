"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import type { PronunciationEntry } from "@/types/retell";

export function PronunciationEditor({
  entries,
  onSave,
  isSaving,
}: {
  entries: PronunciationEntry[];
  onSave: (entries: PronunciationEntry[]) => void;
  isSaving?: boolean;
}) {
  const [word, setWord] = useState("");
  const [alphabet, setAlphabet] = useState<"ipa" | "cmu">("ipa");
  const [phoneme, setPhoneme] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addEntry = () => {
    if (!word.trim() || !phoneme.trim()) {
      setError("Word and phoneme are both required");
      return;
    }
    if (entries.some((e) => e.word.toLowerCase() === word.trim().toLowerCase())) {
      setError(`"${word.trim()}" already has a pronunciation rule`);
      return;
    }
    setError(null);
    onSave([...entries, { word: word.trim(), alphabet, phoneme: phoneme.trim() }]);
    setWord("");
    setPhoneme("");
  };

  const removeEntry = (w: string) => {
    onSave(entries.filter((e) => e.word !== w));
  };

  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-gray-400 mb-3">
        Guide the voice model to pronounce specific words, names, or
        acronyms correctly using IPA or CMU phonetic notation.
      </p>

      {entries.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {entries.map((e) => (
            <li
              key={e.word}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 text-[12px]"
            >
              <div className="min-w-0">
                <span className="font-medium text-gray-700">{e.word}</span>
                <span className="text-gray-400 ml-2 font-mono">
                  /{e.phoneme}/
                </span>
                <span className="text-gray-400 ml-1.5 uppercase text-[10px]">
                  {e.alphabet}
                </span>
              </div>
              <button
                onClick={() => removeEntry(e.word)}
                className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Word"
            value={word}
            onChange={(e) => {
              setWord(e.target.value);
              setError(null);
            }}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
          <select
            value={alphabet}
            onChange={(e) => setAlphabet(e.target.value as "ipa" | "cmu")}
            className="px-2 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shrink-0"
          >
            <option value="ipa">IPA</option>
            <option value="cmu">CMU</option>
          </select>
        </div>
        <input
          type="text"
          placeholder={alphabet === "ipa" ? "e.g. təˈmeɪtoʊ" : "e.g. T AH M EY T OW"}
          value={phoneme}
          onChange={(e) => {
            setPhoneme(e.target.value);
            setError(null);
          }}
          className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 font-mono placeholder:text-gray-400 placeholder:font-sans focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        />
        {error && <p className="text-[11px] text-red-500">{error}</p>}
        <button
          onClick={addEntry}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-[12px] font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Add Pronunciation
        </button>
      </div>
    </div>
  );
}
