"use client";

import { useState } from "react";
import { Plus, Pencil, X, Loader2, Zap, PhoneForwarded, Hash, MessageSquare, Webhook, Variable, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetellLlmTool, BuiltinToolType } from "@/types/retell";

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
  const [error, setError] = useState<string | null>(null);

  // custom webhook
  const [url, setUrl] = useState(initial?.url || "");
  const [method, setMethod] = useState(initial?.method || "POST");
  const [paramsJson, setParamsJson] = useState(
    initial?.parameters ? JSON.stringify(initial.parameters, null, 2) : ""
  );
  const [speakDuring, setSpeakDuring] = useState(initial?.speak_during_execution ?? false);
  const [speakAfter, setSpeakAfter] = useState(initial?.speak_after_execution ?? true);

  // press_digit
  const [delayMs, setDelayMs] = useState(initial?.delay_ms ?? 1000);

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

  const nameConflict = (n: string) =>
    existingNames.some((existing) => existing.toLowerCase() === n.toLowerCase());

  const submit = () => {
    if (toolType === "other") {
      try {
        const parsed = JSON.parse(advancedJson);
        if (!parsed.type || !parsed.name) {
          setError('JSON must include at least "type" and "name" fields');
          return;
        }
        if (nameConflict(parsed.name)) {
          setError(`"${parsed.name}" is already used by another function`);
          return;
        }
        setError(null);
        onSubmit(parsed as RetellLlmTool);
      } catch {
        setError("Invalid JSON — check for missing commas or quotes");
      }
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      setError("Name can only contain letters, numbers, underscores, and hyphens");
      return;
    }
    if (nameConflict(trimmedName)) {
      setError(`"${trimmedName}" is already used by another function`);
      return;
    }

    const base: RetellLlmTool = {
      type: toolType,
      name: trimmedName,
      description: description.trim(),
    };

    if (toolType === "custom") {
      if (!url.trim()) {
        setError("Webhook URL is required");
        return;
      }
      let parameters: RetellLlmTool["parameters"] | undefined;
      if (paramsJson.trim()) {
        try {
          parameters = JSON.parse(paramsJson);
        } catch {
          setError("Parameters must be valid JSON Schema");
          return;
        }
      }
      setError(null);
      onSubmit({
        ...base,
        url: url.trim(),
        method,
        parameters,
        speak_during_execution: speakDuring,
        speak_after_execution: speakAfter,
      });
      return;
    }

    if (toolType === "press_digit") {
      setError(null);
      onSubmit({ ...base, delay_ms: delayMs });
      return;
    }

    if (toolType === "transfer_call") {
      setError(null);
      onSubmit({
        ...base,
        transfer_destination: transferNumber.trim()
          ? { type: "predefined", number: transferNumber.trim() }
          : { type: "inferred" },
        transfer_option: { type: transferKind },
      });
      return;
    }

    if (toolType === "send_sms") {
      setError(null);
      onSubmit({
        ...base,
        sms_content: smsContent.trim()
          ? { type: "predefined", predefined_content: smsContent.trim() }
          : { type: "inferred" },
      });
      return;
    }

    // end_call, extract_dynamic_variable (kept simple — variables can be refined via Advanced JSON)
    setError(null);
    onSubmit(base);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-2.5 bg-white">
      {!initial && (
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          {(Object.keys(TOOL_TYPE_META) as (BuiltinToolType | "other")[]).map((t) => {
            const meta = TOOL_TYPE_META[t];
            const Icon = meta.icon;
            return (
              <button
                key={t}
                onClick={() => setToolType(t)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-colors",
                  toolType === t
                    ? "border-cyan-500 bg-cyan-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span className="text-[11px] text-gray-700 font-medium truncate">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {toolType === "other" ? (
        <textarea
          placeholder={'{\n  "type": "code",\n  "name": "my_tool",\n  "description": "..."\n}'}
          value={advancedJson}
          onChange={(e) => setAdvancedJson(e.target.value)}
          rows={8}
          className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[11px] font-mono text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none"
        />
      ) : (
        <>
          <input
            type="text"
            placeholder="Function name, e.g. transfer_to_sales"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          />
          <textarea
            placeholder="Describe when the agent should use this function"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none"
          />

          {toolType === "custom" && (
            <>
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
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
              <textarea
                placeholder={'Optional JSON Schema for arguments:\n{\n  "type": "object",\n  "properties": { "order_id": { "type": "string" } },\n  "required": ["order_id"]\n}'}
                value={paramsJson}
                onChange={(e) => setParamsJson(e.target.value)}
                rows={4}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[11px] font-mono text-gray-700 placeholder:text-gray-400 placeholder:font-sans focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none"
              />
              <div className="flex items-center gap-4 text-[12px] text-gray-600">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={speakDuring}
                    onChange={(e) => setSpeakDuring(e.target.checked)}
                    className="rounded border-gray-300 text-cyan-500"
                  />
                  Speak while running
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={speakAfter}
                    onChange={(e) => setSpeakAfter(e.target.checked)}
                    className="rounded border-gray-300 text-cyan-500"
                  />
                  Speak after result
                </label>
              </div>
            </>
          )}

          {toolType === "press_digit" && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500">Delay before pressing</span>
              <input
                type="number"
                min={0}
                max={5000}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-24 px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700"
              />
              <span className="text-[11px] text-gray-400">ms</span>
            </div>
          )}

          {toolType === "transfer_call" && (
            <>
              <input
                type="text"
                placeholder="Phone number to transfer to, e.g. +14155551234 (leave blank to let the model decide)"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
              <div className="flex gap-1.5">
                {(["cold_transfer", "warm_transfer"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTransferKind(k)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                      transferKind === k
                        ? "border-cyan-500 bg-cyan-50 text-cyan-600"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    {k === "cold_transfer" ? "Cold Transfer" : "Warm Transfer"}
                  </button>
                ))}
              </div>
            </>
          )}

          {toolType === "send_sms" && (
            <textarea
              placeholder="Message text (leave blank to let the model compose it)"
              value={smsContent}
              onChange={(e) => setSmsContent(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none"
            />
          )}

          {toolType === "extract_dynamic_variable" && (
            <p className="text-[11px] text-gray-400">
              Switch to Advanced (JSON) to configure the specific variables this
              function extracts.
            </p>
          )}
        </>
      )}

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={submit}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-[12px] font-medium hover:bg-cyan-600 disabled:opacity-50 transition-colors"
        >
          {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
          Save Function
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
