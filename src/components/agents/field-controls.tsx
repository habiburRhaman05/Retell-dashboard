"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, X, Plus } from "lucide-react";
import { useState } from "react";

export function SettingsPanel({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        <Icon className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-[13px] font-medium text-gray-700 flex-1">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}

export function SliderSetting({
  label,
  value,
  min,
  max,
  step,
  onSave,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onSave: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setLocal(value);
    setDirty(false);
  }

  return (
    <div className="px-4 py-3 border-t border-gray-50 first:border-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-gray-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded min-w-[36px] text-center">
            {Number.isInteger(step * 10) && step < 1
              ? local.toFixed(1)
              : Math.round(local)}
          </span>
          {dirty && (
            <button
              onClick={() => {
                onSave(local);
                setDirty(false);
              }}
              className="text-[10px] font-medium text-brand-600 hover:text-brand-700"
            >
              Save
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        onChange={(e) => {
          setLocal(parseFloat(e.target.value));
          setDirty(true);
        }}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 accent-brand-500"
      />
    </div>
  );
}

export function ToggleSetting({
  label,
  description,
  value,
  onSave,
}: {
  label: string;
  description?: string;
  value: boolean;
  onSave: (v: boolean) => void;
}) {
  return (
    <div className="px-4 py-3 border-t border-gray-50 first:border-0 flex items-center justify-between gap-3">
      <div>
        <p className="text-[12px] text-gray-600">{label}</p>
        {description && (
          <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={() => onSave(!value)}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors shrink-0",
          value ? "bg-brand-500" : "bg-gray-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
            value ? "left-[18px]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

export function SelectSetting({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
}) {
  return (
    <div className="px-4 py-3 border-t border-gray-50 first:border-0">
      <p className="text-[12px] text-gray-600 mb-1.5">{label}</p>
      <select
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-700 bg-white hover:border-gray-300 transition-all duration-150 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RadioGroupSetting({
  label,
  description,
  value,
  options,
  onSave,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string; description?: string }[];
  onSave: (v: string) => void;
}) {
  return (
    <div className="px-4 py-3 border-t border-gray-50 first:border-0">
      <p className="text-[12px] text-gray-600">{label}</p>
      {description && (
        <p className="text-[11px] text-gray-400 mt-0.5 mb-2">{description}</p>
      )}
      <div className={cn("space-y-1.5", !description && "mt-2")}>
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSave(o.value)}
            className={cn(
              "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors",
              value === o.value
                ? "border-brand-500 bg-brand-50/50"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <span
              className={cn(
                "w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                value === o.value ? "border-brand-500" : "border-gray-300"
              )}
            >
              {value === o.value && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              )}
            </span>
            <span>
              <span className="block text-[12px] text-gray-700">{o.label}</span>
              {o.description && (
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  {o.description}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberSetting({
  label,
  description,
  value,
  min,
  max,
  suffix,
  onSave,
}: {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  suffix?: string;
  onSave: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setLocal(String(value));
  }

  const commit = () => {
    const parsed = Number(local);
    if (Number.isNaN(parsed)) {
      setLocal(String(value));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    setLocal(String(clamped));
    if (clamped !== value) onSave(clamped);
  };

  return (
    <div className="px-4 py-3 border-t border-gray-50 first:border-0">
      <p className="text-[12px] text-gray-600">{label}</p>
      {description && (
        <p className="text-[11px] text-gray-400 mt-0.5 mb-1.5">{description}</p>
      )}
      <div className={cn("flex items-center gap-2", !description && "mt-1.5")}>
        <input
          type="number"
          value={local}
          min={min}
          max={max}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-700 bg-white hover:border-gray-300 transition-all duration-150 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
        />
        {suffix && <span className="text-[11px] text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

export function TextSetting({
  label,
  description,
  value,
  placeholder,
  multiline,
  onSave,
}: {
  label: string;
  description?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setLocal(value);
    setDirty(false);
  }

  const commit = () => {
    if (dirty) onSave(local);
    setDirty(false);
  };

  return (
    <div className="px-4 py-3 border-t border-gray-50 first:border-0">
      <p className="text-[12px] text-gray-600 mb-1.5">{label}</p>
      {description && (
        <p className="text-[11px] text-gray-400 -mt-1 mb-1.5">{description}</p>
      )}
      {multiline ? (
        <textarea
          value={local}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => {
            setLocal(e.target.value);
            setDirty(true);
          }}
          onBlur={commit}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-700 bg-white placeholder:text-gray-400 hover:border-gray-300 transition-all duration-150 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 resize-none"
        />
      ) : (
        <input
          type="text"
          value={local}
          placeholder={placeholder}
          onChange={(e) => {
            setLocal(e.target.value);
            setDirty(true);
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-700 bg-white placeholder:text-gray-400 hover:border-gray-300 transition-all duration-150 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
        />
      )}
    </div>
  );
}

export function TagListSetting({
  label,
  description,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  description?: string;
  value: string[];
  placeholder?: string;
  onSave: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) {
      setInput("");
      return;
    }
    onSave([...value, trimmed]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onSave(value.filter((t) => t !== tag));
  };

  return (
    <div className="px-4 py-3 border-t border-gray-50 first:border-0">
      <p className="text-[12px] text-gray-600">{label}</p>
      {description && (
        <p className="text-[11px] text-gray-400 mt-0.5 mb-1.5">{description}</p>
      )}
      <div className={cn("flex items-center gap-2", !description && "mt-1.5")}>
        <input
          type="text"
          value={input}
          placeholder={placeholder || "Type and press Enter"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-700 bg-white placeholder:text-gray-400 hover:border-gray-300 transition-all duration-150 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
        />
        <button
          onClick={addTag}
          disabled={!input.trim()}
          className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-[11px] text-gray-700"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
