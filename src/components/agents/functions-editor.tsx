"use client";

import { useState } from "react";
import { Plus, Pencil, X, Loader2, AlertCircle, Zap, PhoneForwarded, Hash, MessageSquare, Webhook, Variable, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetellLlmTool, BuiltinToolType } from "@/types/retell";
import { jsonObjectError, normalizePhone, phoneError, toolNameError, urlError } from "@/lib/validation";

const TOOL_TYPE_META: Record<
  BuiltinToolType | "other",
  { label: string; icon: typeof Zap; description: string }
> = {
  end_call: { label: "End Call", icon: Zap, description: "Hang up the call" },
  transfer_call: {
    label: "Transfer Call",
    icon: PhoneForwarded,
    description: "Transfer to a human or another number",
  },
  press_digit: {
    label: "Press Digit",
    icon: Hash,
    description: "Send DTMF tones to navigate an IVR menu",
  },
  send_sms: { label: "Send SMS", icon: MessageSquare, description: "Send a text message" },
  custom: {
    label: "Custom Webhook",
    icon: Webhook,
    description: "Call your own API during the conversation",
  },
  extract_dynamic_variable: {
    label: "Extract Variable",
    icon: Variable,
    description: "Pull a value out of the conversation",
  },
  other: {
    label: "Advanced (JSON)",
    icon: Code2,
    description: "Any other tool type, configured as raw JSON",
  },
};

export function FunctionsEditor({
  tools,
  onSave,
  isSaving,
}: {
  tools: RetellLlmTool[];
  onSave: (tools: RetellLlmTool[]) => void;
  isSaving?: boolean;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (tool: RetellLlmTool) => {
    if (editingIndex === null) {
      onSave([...tools, tool]);
    } else {
      onSave(tools.map((t, i) => (i === editingIndex ? tool : t)));
    }
    setShowForm(false);
    setEditingIndex(null);
  };

  const removeTool = (index: number) => {
    onSave(tools.filter((_, i) => i !== index));
  };

  return (
    <div className="px-4 py-3">
      <p className="text-[11px] text-gray-400 mb-3">
        Give the agent abilities to call during a conversation: end the call,
        transfer it, send an SMS, hit your own API, and more.
      </p>

      {tools.length > 0 ? (
        <div className="space-y-2 mb-3">
          {tools.map((tool, i) => {
            const meta =
              TOOL_TYPE_META[tool.type as BuiltinToolType] || TOOL_TYPE_META.other;
            const Icon = meta.icon;
            return (
              <div
                key={i}
                className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg bg-gray-50"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-gray-700 truncate">
                      {tool.name}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {meta.label}
                      {tool.description ? ` · ${tool.description}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditingIndex(i);
                      setShowForm(true);
                    }}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeTool(i)}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !showForm && (
          <p className="text-[12px] text-gray-400 text-center py-3">
            No functions configured
          </p>
        )
      )}

      {showForm ? (
        <ToolForm
          initial={editingIndex !== null ? tools[editingIndex] : undefined}
          existingNames={tools
            .filter((_, i) => i !== editingIndex)
            .map((t) => t.name)}
          onCancel={() => {
            setShowForm(false);
            setEditingIndex(null);
          }}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      ) : (
        <button
          onClick={() => {
            setEditingIndex(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-[12px] font-medium hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Function
        </button>
      )}
    </div>
  );
}

type FieldKey = "name" | "url" | "phone" | "params" | "delay" | "sms" | "json";
type Errors = Partial<Record<FieldKey, string>>;

const fieldBase =
  "w-full px-2.5 py-1.5 rounded-md border text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 transition-colors";
const fieldClass = (err?: string) =>
  cn(
    fieldBase,
    err
      ? "border-red-400 bg-red-50/40 focus:ring-red-500/20 focus:border-red-500"
      : "border-gray-200 focus:ring-brand-500/20 focus:border-brand-500"
  );

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-1 text-[11px] text-red-600 mt-1">
      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

function ToolForm({
  initial,
  existingNames,
  onSubmit,
  onCancel,
  isSaving,
}: {
  initial?: RetellLlmTool;
  existingNames: string[];
  onSubmit: (tool: RetellLlmTool) => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  const initialType: BuiltinToolType | "other" =
    initial &&
    ["custom", "end_call", "transfer_call", "press_digit", "send_sms", "extract_dynamic_variable"].includes(
      initial.type
    )
      ? (initial.type as BuiltinToolType)
      : initial
      ? "other"
      : "end_call";

  const [toolType, setToolType] = useState<BuiltinToolType | "other">(initialType);
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [errors, setErrors] = useState<Errors>({});

  // custom webhook
  const [url, setUrl] = useState(initial?.url || "");
  const [method, setMethod] = useState(initial?.method || "POST");
  const [paramsJson, setParamsJson] = useState(
    initial?.parameters ? JSON.stringify(initial.parameters, null, 2) : ""
  );
  const [speakDuring, setSpeakDuring] = useState(initial?.speak_during_execution ?? false);
  const [speakAfter, setSpeakAfter] = useState(initial?.speak_after_execution ?? true);

  // press_digit
  const [delayMs, setDelayMs] = useState(String(initial?.delay_ms ?? 1000));

  // transfer_call
  const [transferNumber, setTransferNumber] = useState(
    initial?.transfer_destination?.number || ""
  );
  const [transferKind, setTransferKind] = useState<"cold_transfer" | "warm_transfer">(
    initial?.transfer_option?.type || "cold_transfer"
  );

  // send_sms
  const [smsContent, setSmsContent] = useState(
    initial?.sms_content?.predefined_content || ""
  );

  // advanced JSON
  const [advancedJson, setAdvancedJson] = useState(
    initial && toolType === "other" ? JSON.stringify(initial, null, 2) : ""
  );

  const setError = (key: FieldKey, message: string | null) =>
    setErrors((prev) => ({ ...prev, [key]: message ?? undefined }));

  // Each check returns a message or null, so a field can be checked on blur
  // and again, together with the others, on submit.
  const checks: Record<FieldKey, () => string | null> = {
    name: () => toolNameError(name, existingNames),
    url: () => urlError(url),
    phone: () => phoneError(transferNumber),
    params: () => jsonObjectError(paramsJson),
    delay: () => {
      const n = Number(delayMs);
      if (delayMs.trim() === "" || !Number.isInteger(n)) return "Enter a whole number of milliseconds";
      if (n < 0 || n > 5000) return "Choose between 0 and 5000 ms";
      return null;
    },
    sms: () => (smsContent.length > 1600 ? "Keep the message under 1600 characters" : null),
    json: () => {
      if (!advancedJson.trim()) return "Paste the function as JSON";
      try {
        const parsed = JSON.parse(advancedJson);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return "Must be a JSON object, like { ... }";
        }
        if (!parsed.type || !parsed.name) return 'The JSON needs at least a "type" and a "name"';
        return toolNameError(String(parsed.name), existingNames);
      } catch {
        return "Not valid JSON. Check for missing commas, quotes or brackets";
      }
    },
  };

  const fieldsFor = (): FieldKey[] => {
    if (toolType === "other") return ["json"];
    const base: FieldKey[] = ["name"];
    if (toolType === "custom") return [...base, "url", "params"];
    if (toolType === "transfer_call") return [...base, "phone"];
    if (toolType === "press_digit") return [...base, "delay"];
    if (toolType === "send_sms") return [...base, "sms"];
    return base;
  };

  const validate = (key: FieldKey) => setError(key, checks[key]());

  const submit = () => {
    const found: Errors = {};
    for (const key of fieldsFor()) {
      const message = checks[key]();
      if (message) found[key] = message;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (toolType === "other") {
      onSubmit(JSON.parse(advancedJson) as RetellLlmTool);
      return;
    }

    const base: RetellLlmTool = {
      type: toolType,
      name: name.trim(),
      description: description.trim(),
    };

    if (toolType === "custom") {
      onSubmit({
        ...base,
        url: url.trim(),
        method,
        parameters: paramsJson.trim() ? JSON.parse(paramsJson) : undefined,
        speak_during_execution: speakDuring,
        speak_after_execution: speakAfter,
      });
      return;
    }

    if (toolType === "press_digit") {
      onSubmit({ ...base, delay_ms: Number(delayMs) });
      return;
    }

    if (toolType === "transfer_call") {
      const number = normalizePhone(transferNumber);
      onSubmit({
        ...base,
        transfer_destination: number ? { type: "predefined", number } : { type: "inferred" },
        transfer_option: { type: transferKind },
      });
      return;
    }

    if (toolType === "send_sms") {
      onSubmit({
        ...base,
        sms_content: smsContent.trim()
          ? { type: "predefined", predefined_content: smsContent.trim() }
          : { type: "inferred" },
      });
      return;
    }

    // end_call, extract_dynamic_variable (kept simple - variables can be refined via Advanced JSON)
    onSubmit(base);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-2.5 bg-white">
      {!initial && (
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          {(Object.keys(TOOL_TYPE_META) as (BuiltinToolType | "other")[]).map((t) => {
            const meta = TOOL_TYPE_META[t];
            const Icon = meta.icon;
            const active = toolType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setToolType(t);
                  setErrors({});
                }}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-colors",
                  active
                    ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                    : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 shrink-0", active ? "text-white" : "text-gray-500")} />
                <span className="text-[11px] font-medium truncate">{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {toolType === "other" ? (
        <div>
          <textarea
            placeholder={'{\n  "type": "code",\n  "name": "my_tool",\n  "description": "..."\n}'}
            value={advancedJson}
            onChange={(e) => {
              setAdvancedJson(e.target.value);
              if (errors.json) setError("json", null);
            }}
            onBlur={() => advancedJson.trim() && validate("json")}
            rows={8}
            spellCheck={false}
            className={cn(fieldClass(errors.json), "font-mono text-[11px] resize-none")}
          />
          <FieldError message={errors.json} />
        </div>
      ) : (
        <>
          <div>
            <input
              type="text"
              placeholder="Function name, e.g. transfer_to_sales"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setError("name", null);
              }}
              onBlur={() => name.trim() && validate("name")}
              className={fieldClass(errors.name)}
            />
            <FieldError message={errors.name} />
          </div>
          <textarea
            placeholder="Describe when the agent should use this function"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={cn(fieldClass(), "resize-none")}
          />

          {toolType === "custom" && (
            <>
              <div>
                <div className="flex gap-2">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof method)}
                    className="px-2 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 bg-white shrink-0"
                  >
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="https://your-api.com/endpoint"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (errors.url) setError("url", null);
                    }}
                    onBlur={() => url.trim() && validate("url")}
                    className={cn(fieldClass(errors.url), "flex-1 min-w-0")}
                  />
                </div>
                <FieldError message={errors.url} />
              </div>
              <div>
                <textarea
                  placeholder={'Optional JSON Schema for arguments:\n{\n  "type": "object",\n  "properties": { "order_id": { "type": "string" } },\n  "required": ["order_id"]\n}'}
                  value={paramsJson}
                  onChange={(e) => {
                    setParamsJson(e.target.value);
                    if (errors.params) setError("params", null);
                  }}
                  onBlur={() => validate("params")}
                  rows={4}
                  spellCheck={false}
                  className={cn(fieldClass(errors.params), "text-[11px] font-mono placeholder:font-sans resize-none")}
                />
                <FieldError message={errors.params} />
              </div>
              <div className="flex items-center gap-4 text-[12px] text-gray-600">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={speakDuring}
                    onChange={(e) => setSpeakDuring(e.target.checked)}
                    className="rounded border-gray-300 accent-brand-500"
                  />
                  Speak while running
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={speakAfter}
                    onChange={(e) => setSpeakAfter(e.target.checked)}
                    className="rounded border-gray-300 accent-brand-500"
                  />
                  Speak after result
                </label>
              </div>
            </>
          )}

          {toolType === "press_digit" && (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-gray-500">Delay before pressing</span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={delayMs}
                  onChange={(e) => {
                    setDelayMs(e.target.value);
                    if (errors.delay) setError("delay", null);
                  }}
                  onBlur={() => validate("delay")}
                  className={cn(fieldClass(errors.delay), "w-24")}
                />
                <span className="text-[11px] text-gray-400">ms</span>
              </div>
              <FieldError message={errors.delay} />
            </div>
          )}

          {toolType === "transfer_call" && (
            <>
              <div>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone number to transfer to, e.g. +14155551234 (leave blank to let the model decide)"
                  value={transferNumber}
                  onChange={(e) => {
                    setTransferNumber(e.target.value);
                    if (errors.phone) setError("phone", null);
                  }}
                  onBlur={() => validate("phone")}
                  className={fieldClass(errors.phone)}
                />
                <FieldError message={errors.phone} />
                {!errors.phone && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    International format: + then the country code and number, no spaces.
                  </p>
                )}
              </div>
              <div className="flex gap-1.5">
                {(["cold_transfer", "warm_transfer"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTransferKind(k)}
                    aria-pressed={transferKind === k}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
                      transferKind === k
                        ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {k === "cold_transfer" ? "Cold Transfer" : "Warm Transfer"}
                  </button>
                ))}
              </div>
            </>
          )}

          {toolType === "send_sms" && (
            <div>
              <textarea
                placeholder="Message text (leave blank to let the model compose it)"
                value={smsContent}
                onChange={(e) => {
                  setSmsContent(e.target.value);
                  if (errors.sms) setError("sms", null);
                }}
                onBlur={() => validate("sms")}
                rows={2}
                className={cn(fieldClass(errors.sms), "resize-none")}
              />
              <FieldError message={errors.sms} />
            </div>
          )}

          {toolType === "extract_dynamic_variable" && (
            <p className="text-[11px] text-gray-400">
              Switch to Advanced (JSON) to configure the specific variables this
              function extracts.
            </p>
          )}
        </>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 text-white text-[12px] font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
          Save Function
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        {Object.keys(errors).some((k) => errors[k as FieldKey]) && (
          <span className="text-[11px] text-red-500 ml-1">Fix the highlighted fields</span>
        )}
      </div>
    </div>
  );
}
