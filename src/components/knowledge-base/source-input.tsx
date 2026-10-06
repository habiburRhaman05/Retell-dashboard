"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { KnowledgeBaseTextInput } from "@/types/retell";
import { FileText, Link2, Type, X, Upload } from "lucide-react";

export type SourceTab = "files" | "text" | "url";

const MAX_FILES = 25;
const MAX_FILE_SIZE_MB = 50;

export interface SourceInputValue {
  files: File[];
  texts: KnowledgeBaseTextInput[];
  urls: string[];
}

/** Lets a parent force any text/URL the user typed but hadn't clicked
 * "Add" on yet into `value` right before submitting — otherwise a filled
 * form with an un-clicked Add button silently submits as zero sources. */
export interface SourceInputPanelHandle {
  commitPending: () => SourceInputValue;
}

export const SourceInputPanel = forwardRef<SourceInputPanelHandle, {
  value: SourceInputValue;
  onChange: (value: SourceInputValue) => void;
}>(function SourceInputPanel({ value, onChange }, ref) {
  const [tab, setTab] = useState<SourceTab>("files");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const tabs: { id: SourceTab; label: string; icon: typeof FileText }[] = [
    { id: "files", label: "Files", icon: FileText },
    { id: "text", label: "Text", icon: Type },
    { id: "url", label: "URL", icon: Link2 },
  ];

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    setFileError(null);
    const incoming = Array.from(fileList);
    const tooLarge = incoming.filter(
      (f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024
    );
    if (tooLarge.length > 0) {
      setFileError(
        `${tooLarge.map((f) => f.name).join(", ")} exceed${
          tooLarge.length === 1 ? "s" : ""
        } the ${MAX_FILE_SIZE_MB}MB limit`
      );
    }
    const valid = incoming.filter(
      (f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024
    );
    const combined = [...value.files, ...valid];
    if (combined.length > MAX_FILES) {
      setFileError(`You can only attach up to ${MAX_FILES} files`);
    }
    onChange({ ...value, files: combined.slice(0, MAX_FILES) });
  };

  const removeFile = (index: number) => {
    setFileError(null);
    onChange({ ...value, files: value.files.filter((_, i) => i !== index) });
  };

  const addText = () => {
    if (!textTitle.trim() || !textBody.trim()) return;
    onChange({
      ...value,
      texts: [...value.texts, { title: textTitle.trim(), text: textBody.trim() }],
    });
    setTextTitle("");
    setTextBody("");
  };

  const removeText = (index: number) => {
    onChange({ ...value, texts: value.texts.filter((_, i) => i !== index) });
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      setUrlError("Enter a valid URL, e.g. https://example.com");
      return;
    }
    setUrlError(null);
    onChange({ ...value, urls: [...value.urls, trimmed] });
    setUrlInput("");
  };

  const removeUrl = (index: number) => {
    onChange({ ...value, urls: value.urls.filter((_, i) => i !== index) });
  };

  useImperativeHandle(ref, () => ({
    commitPending: () => {
      let next = value;

      if (textTitle.trim() && textBody.trim()) {
        next = {
          ...next,
          texts: [...next.texts, { title: textTitle.trim(), text: textBody.trim() }],
        };
        setTextTitle("");
        setTextBody("");
      }

      const trimmedUrl = urlInput.trim();
      if (trimmedUrl) {
        try {
          new URL(trimmedUrl);
          next = { ...next, urls: [...next.urls, trimmedUrl] };
          setUrlInput("");
        } catch {
          setUrlError("Enter a valid URL, e.g. https://example.com");
        }
      }

      if (next !== value) onChange(next);
      return next;
    },
  }));

  const totalSources = value.files.length + value.texts.length + value.urls.length;

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-cyan-500 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "files" && (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-cyan-300 hover:bg-cyan-50/30 transition-colors"
          >
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-[13px] text-gray-600">
              Click to upload or drag and drop
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Up to {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB each
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>
          {fileError && (
            <p className="text-xs text-red-500 mt-2">{fileError}</p>
          )}
          {value.files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {value.files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 text-[12px]"
                >
                  <span className="truncate text-gray-700">{f.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-400">
                      {(f.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "text" && (
        <div>
          <input
            type="text"
            placeholder="Title"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all mb-2"
          />
          <textarea
            placeholder="Paste or write the text content..."
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            rows={4}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all resize-none"
          />
          <button
            type="button"
            onClick={addText}
            disabled={!textTitle.trim() || !textBody.trim()}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-[12px] font-medium hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add Text Entry
          </button>
          {value.texts.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {value.texts.map((t, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 text-[12px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-700 truncate">{t.title}</p>
                    <p className="text-gray-400 truncate">{t.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeText(i)}
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "url" && (
        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="https://example.com/docs"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
            <button
              type="button"
              onClick={addUrl}
              disabled={!urlInput.trim()}
              className="px-3.5 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-[13px] font-medium hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              Add
            </button>
          </div>
          {urlError && <p className="text-xs text-red-500 mt-2">{urlError}</p>}
          {value.urls.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {value.urls.map((u, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 text-[12px]"
                >
                  <span className="truncate text-gray-700">{u}</span>
                  <button
                    type="button"
                    onClick={() => removeUrl(i)}
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {totalSources > 0 && (
        <p className="text-[11px] text-gray-400 mt-3">
          {totalSources} source{totalSources !== 1 ? "s" : ""} ready to add
        </p>
      )}
    </div>
  );
});
