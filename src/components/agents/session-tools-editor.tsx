"use client";

import { useState } from "react";
import { ChevronDown, Code2, MessageSquareText, Pencil, Plus, Plug, Trash2, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SessionTool } from "@/types/retell";

type ToolKind = SessionTool["type"];

export const TOOL_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  custom: { label: "Custom function", icon: Wrench },
  code: { label: "Code", icon: Code2 },
  send_sms: { label: "Send SMS", icon: MessageSquareText },
  integration_app: { label: "Integration", icon: Plug },
};

export function toolMeta(type: string) {
  return TOOL_META[type] ?? { label: type.replace(/_/g, " "), icon: Wrench };
}

const NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const OPERATORS = ["==", "!=", ">", ">=", "<", "<=", "contains", "not_contains", "exists", "not_exist"] as const;

interface Equation {
  left: string;
  operator: string;
  right?: string;
}
interface Condition {
  type: "equation";
  equations: Equation[];
  operator: "&&" | "||";
}

function nextName(base: string, tools: SessionTool[]): string {
  const taken = new Set(tools.map((t) => t.name));
  for (let i = 1; i < 100; i++) {
    const n = `${base}_${i}`;
    if (!taken.has(n)) return n;
  }
  return `${base}_${Date.now()}`;
}

export function newTool(kind: "custom" | "code" | "send_sms", tools: SessionTool[]): SessionTool {
  if (kind === "code") {
    return { type: "code", name: nextName("code_function", tools), code: "return {};" };
  }
  if (kind === "send_sms") {
    return {
      type: "send_sms",
      name: nextName("send_sms", tools),
      sms_content: { type: "predefined", text: "" },
    };
  }
  return { type: "custom", name: nextName("custom_function", tools), url: "", method: "POST" };
}

const selectClass =
  "w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-gray-700 mb-1">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 -mt-0.5 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  value: [string, string][];
  onChange: (v: [string, string][]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  return (
    <div className="space-y-1.5">
      {value.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={k}
            placeholder={keyPlaceholder}
            onChange={(e) => {
              const next = e.target.value;
              onChange(value.map((p, j) => (j === i ? [next, p[1]] : p)));
            }}
            className="w-2/5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[12px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          />
          <input
            value={v}
            placeholder={valuePlaceholder}
            onChange={(e) => {
              const next = e.target.value;
              onChange(value.map((p, j) => (j === i ? [p[0], next] : p)));
            }}
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[12px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          />
          <button
            type="button"
            aria-label="Remove row"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => onChange([...value, ["", ""]])}>
        Add
      </Button>
    </div>
  );
}

const toPairs = (o?: Record<string, string>): [string, string][] => Object.entries(o ?? {});
const fromPairs = (p: [string, string][]): Record<string, string> =>
  Object.fromEntries(p.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), v]));

function ToolForm({
  tool,
  others,
  kind,
  isNew,
  isSaving,
  onCancel,
  onSubmit,
}: {
  tool: SessionTool;
  others: SessionTool[];
  kind: "pre" | "post";
  isNew: boolean;
  isSaving?: boolean;
  onCancel: () => void;
  onSubmit: (tool: SessionTool) => Promise<void> | void;
}) {
  const meta = toolMeta(tool.type);
  const [name, setName] = useState(tool.name);
  const [description, setDescription] = useState(tool.description ?? "");
  const [url, setUrl] = useState(tool.url ?? "");
  const [method, setMethod] = useState(tool.method ?? "POST");
  const [timeout, setTimeoutMs] = useState(tool.timeout_ms ? String(tool.timeout_ms) : "");
  const [headers, setHeaders] = useState(toPairs(tool.headers));
  const [responseVars, setResponseVars] = useState(toPairs(tool.response_variables));
  const [paramsText, setParamsText] = useState(
    tool.parameters ? JSON.stringify(tool.parameters, null, 2) : ""
  );
  const [code, setCode] = useState(tool.code ?? "");
  const [smsType, setSmsType] = useState(tool.sms_content?.type ?? "predefined");
  const [smsText, setSmsText] = useState(tool.sms_content?.text ?? tool.sms_content?.prompt ?? "");
  const [dependsOn, setDependsOn] = useState<string[]>(tool.depends_on ?? []);
  const [cond, setCond] = useState<Condition | null>((tool.condition as Condition | undefined) ?? null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const editable = tool.type === "custom" || tool.type === "code" || tool.type === "send_sms";

  const build = (): SessionTool | null => {
    const problems: string[] = [];
    if (!NAME_RE.test(name)) {
      problems.push("The name can use letters, numbers, underscores and dashes (up to 64 characters).");
    } else if (others.some((t) => t.name === name)) {
      problems.push("Another function already uses this name.");
    }
    const next: SessionTool = { ...tool, name, description: description.trim() || undefined };

    if (tool.type === "custom") {
      if (!/^https?:\/\/\S+$/i.test(url.trim())) problems.push("Enter a full URL starting with http:// or https://.");
      next.url = url.trim();
      next.method = method as SessionTool["method"];
      next.headers = fromPairs(headers);
      if (Object.keys(next.headers).length === 0) delete next.headers;
      next.response_variables = fromPairs(responseVars);
      if (Object.keys(next.response_variables).length === 0) delete next.response_variables;
      if (timeout.trim()) {
        const n = Number(timeout);
        if (!Number.isFinite(n) || n < 1000 || n > 600000) problems.push("Timeout must be between 1000 and 600000 ms.");
        else next.timeout_ms = n;
      } else delete next.timeout_ms;
      if (paramsText.trim()) {
        try {
          const parsed = JSON.parse(paramsText);
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
          next.parameters = parsed;
        } catch {
          problems.push("Parameters must be a valid JSON schema object.");
        }
      } else delete next.parameters;
    }
    if (tool.type === "code") {
      if (!code.trim()) problems.push("Add the code to run.");
      next.code = code;
      next.response_variables = fromPairs(responseVars);
      if (Object.keys(next.response_variables).length === 0) delete next.response_variables;
    }
    if (tool.type === "send_sms") {
      if (!smsText.trim()) problems.push("Add the SMS text or prompt.");
      next.sms_content =
        smsType === "inferred" ? { type: "inferred", prompt: smsText } : { type: "predefined", text: smsText };
    }

    next.depends_on = dependsOn.filter((d) => others.some((t) => t.name === d));
    if (next.depends_on.length === 0) delete next.depends_on;

    if (kind === "post" && cond && cond.equations.length > 0) {
      if (cond.equations.some((e) => !e.left.trim())) problems.push("Each condition needs a variable name.");
      next.condition = {
        type: "equation",
        operator: cond.operator,
        equations: cond.equations.map((e) =>
          e.operator === "exists" || e.operator === "not_exist"
            ? { left: e.left.trim(), operator: e.operator }
            : { left: e.left.trim(), operator: e.operator, right: e.right ?? "" }
        ),
      };
    } else {
      delete next.condition;
    }

    setErrors(problems);
    return problems.length ? null : next;
  };

  const submit = async () => {
    const next = build();
    if (next) await onSubmit(next);
  };

  const openJson = () => {
    const next = build() ?? tool;
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError(null);
    setShowJson((v) => !v);
  };

  const applyJson = async () => {
    try {
      const parsed = JSON.parse(jsonText) as SessionTool;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
      if (!parsed.type || !parsed.name) throw new Error("The tool needs a type and a name");
      if (!NAME_RE.test(parsed.name)) throw new Error("Invalid name");
      if (others.some((t) => t.name === parsed.name)) throw new Error("Another function already uses this name");
      setJsonError(null);
      await onSubmit(parsed);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/20 p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <meta.icon className="w-4 h-4 text-brand-600" />
        <p className="text-[13px] font-semibold text-gray-900">
          {isNew ? "New" : "Edit"} {meta.label.toLowerCase()}
        </p>
        <button onClick={onCancel} aria-label="Cancel" className="ml-auto p-1 rounded-md hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 list-disc pl-6 text-[12px] text-red-600 space-y-0.5">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {!editable && (
        <p className="text-[12px] text-gray-600 rounded-lg bg-white border border-gray-200 px-3 py-2">
          This {meta.label.toLowerCase()} function was set up in Retell. You can rename it, change dependencies
          or edit its JSON here. Connecting new integrations is done in Retell.
        </p>
      )}

      <Field label="Name" hint="Letters, numbers, underscores and dashes">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this function do?"
        />
      </Field>

      {tool.type === "custom" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Field label="Method">
                <select className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="URL">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/lookup" />
              </Field>
            </div>
          </div>
          <Field label="Headers">
            <KeyValueEditor value={headers} onChange={setHeaders} keyPlaceholder="Authorization" valuePlaceholder="Bearer ..." />
          </Field>
          <Field label="Parameters (JSON schema)" hint="The inputs this function receives. Leave empty for none.">
            <textarea
              rows={6}
              spellCheck={false}
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              placeholder={'{\n  "type": "object",\n  "properties": {\n    "phone": { "type": "string" }\n  }\n}'}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            />
          </Field>
          <Field label="Save response as variables" hint="Variable name and the path in the response, e.g. data.name">
            <KeyValueEditor value={responseVars} onChange={setResponseVars} keyPlaceholder="customer_name" valuePlaceholder="data.name" />
          </Field>
          <Field label="Timeout (ms)" hint="Between 1000 and 600000. Optional.">
            <Input value={timeout} onChange={(e) => setTimeoutMs(e.target.value)} placeholder="120000" inputMode="numeric" />
          </Field>
        </>
      )}

      {tool.type === "code" && (
        <>
          <Field label="Code" hint="JavaScript that returns an object. Its fields can be saved as variables.">
            <textarea
              rows={8}
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            />
          </Field>
          <Field label="Save response as variables">
            <KeyValueEditor value={responseVars} onChange={setResponseVars} keyPlaceholder="total" valuePlaceholder="result.total" />
          </Field>
        </>
      )}

      {tool.type === "send_sms" && (
        <>
          <Field label="Message type">
            <select className={selectClass} value={smsType} onChange={(e) => setSmsType(e.target.value)}>
              <option value="predefined">Fixed text</option>
              <option value="inferred">Written by AI from a prompt</option>
            </select>
          </Field>
          <Field label={smsType === "inferred" ? "Prompt" : "Text"}>
            <Textarea rows={3} value={smsText} onChange={(e) => setSmsText(e.target.value)} />
          </Field>
        </>
      )}

      {others.length > 0 && (
        <Field label="Runs after" hint="Wait for these functions to finish first">
          <div className="space-y-1">
            {others.map((o) => (
              <label key={o.name} className="flex items-center gap-2 text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  checked={dependsOn.includes(o.name)}
                  onChange={(e) =>
                    setDependsOn((prev) => (e.target.checked ? [...prev, o.name] : prev.filter((x) => x !== o.name)))
                  }
                  className="rounded border-gray-300 accent-brand-500"
                />
                {o.name}
              </label>
            ))}
          </div>
        </Field>
      )}

      {kind === "post" && (
        <Field label="Only run when" hint="Leave empty to always run after the call ends">
          {cond && cond.equations.length > 0 ? (
            <div className="space-y-2">
              {cond.equations.map((eq, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    value={eq.left}
                    placeholder="variable"
                    onChange={(e) => {
                      const v = e.target.value;
                      setCond({ ...cond, equations: cond.equations.map((x, j) => (j === i ? { ...x, left: v } : x)) });
                    }}
                    className="w-1/3 px-2 py-1.5 rounded-lg border border-gray-200 text-[12px]"
                  />
                  <select
                    value={eq.operator}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCond({ ...cond, equations: cond.equations.map((x, j) => (j === i ? { ...x, operator: v } : x)) });
                    }}
                    className="px-1.5 py-1.5 rounded-lg border border-gray-200 text-[12px] bg-white"
                  >
                    {OPERATORS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  {eq.operator !== "exists" && eq.operator !== "not_exist" && (
                    <input
                      value={eq.right ?? ""}
                      placeholder="value"
                      onChange={(e) => {
                        const v = e.target.value;
                        setCond({ ...cond, equations: cond.equations.map((x, j) => (j === i ? { ...x, right: v } : x)) });
                      }}
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-[12px]"
                    />
                  )}
                  <button
                    aria-label="Remove condition"
                    onClick={() => {
                      const eqs = cond.equations.filter((_, j) => j !== i);
                      setCond(eqs.length ? { ...cond, equations: eqs } : null);
                    }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Plus}
                  onClick={() => setCond({ ...cond, equations: [...cond.equations, { left: "", operator: "==", right: "" }] })}
                >
                  Add condition
                </Button>
                {cond.equations.length > 1 && (
                  <select
                    value={cond.operator}
                    onChange={(e) => setCond({ ...cond, operator: e.target.value as "&&" | "||" })}
                    className="px-2 py-1.5 rounded-lg border border-gray-200 text-[12px] bg-white"
                  >
                    <option value="&&">All must match</option>
                    <option value="||">Any can match</option>
                  </select>
                )}
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setCond({ type: "equation", operator: "&&", equations: [{ left: "", operator: "==", right: "" }] })}
            >
              Add condition
            </Button>
          )}
        </Field>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" loading={isSaving} disabled={isSaving} onClick={submit}>
          {isNew ? "Add function" : "Save function"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <button onClick={openJson} className="ml-auto text-[11px] text-gray-500 hover:text-gray-800">
          {showJson ? "Hide JSON" : "Edit as JSON"}
        </button>
      </div>

      {showJson && (
        <div className="space-y-2">
          <textarea
            rows={10}
            spellCheck={false}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-700"
          />
          {jsonError && <p className="text-[12px] text-red-600">{jsonError}</p>}
          <Button size="sm" variant="secondary" onClick={applyJson} disabled={isSaving}>
            Save from JSON
          </Button>
        </div>
      )}
    </div>
  );
}

export function SessionToolsEditor({
  tools,
  kind,
  isSaving,
  onSave,
}: {
  tools: SessionTool[];
  kind: "pre" | "post";
  isSaving?: boolean;
  /** Resolves to false when saving failed so the form stays open. */
  onSave: (tools: SessionTool[]) => Promise<boolean | void> | boolean | void;
}) {
  const [editing, setEditing] = useState<{ index: number | null; tool: SessionTool } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const addKinds: ("custom" | "code" | "send_sms")[] =
    kind === "post" ? ["code", "custom", "send_sms"] : ["code", "custom"];

  const submit = async (tool: SessionTool) => {
    const index = editing?.index ?? null;
    const oldName = index === null ? null : tools[index]?.name;
    let next: SessionTool[];
    if (index === null) next = [...tools, tool];
    else {
      next = tools.map((t, i) => (i === index ? tool : t));
      // Keep "runs after" links intact when a function is renamed.
      if (oldName && oldName !== tool.name) {
        next = next.map((t) =>
          t.depends_on?.includes(oldName)
            ? { ...t, depends_on: t.depends_on.map((d) => (d === oldName ? tool.name : d)) }
            : t
        );
      }
    }
    const ok = await onSave(next);
    if (ok !== false) setEditing(null);
  };

  const remove = async (index: number) => {
    const removed = tools[index];
    if (!confirm(`Remove "${removed.name}"?`)) return;
    const next = tools
      .filter((_, i) => i !== index)
      .map((t) =>
        t.depends_on?.includes(removed.name)
          ? { ...t, depends_on: t.depends_on.filter((d) => d !== removed.name) }
          : t
      );
    await onSave(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-gray-500">
        {kind === "pre"
          ? "Run before the call starts, for example to look up the caller. Results become variables the agent can use."
          : "Run after the call ends, for example to log the outcome or send a follow-up. Each one can have its own condition."}
      </p>

      {tools.length === 0 && !editing && (
        <p className="text-[12px] text-gray-400 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center">
          No functions yet
        </p>
      )}

      <ul className="space-y-1.5">
        {tools.map((t, i) => {
          const m = toolMeta(t.type);
          const isEditing = editing?.index === i;
          return (
            <li key={`${t.name}-${i}`}>
              {isEditing ? (
                <ToolForm
                  key={`form-${t.name}-${i}`}
                  tool={editing.tool}
                  others={tools.filter((_, j) => j !== i)}
                  kind={kind}
                  isNew={false}
                  isSaving={isSaving}
                  onCancel={() => setEditing(null)}
                  onSubmit={submit}
                />
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <m.icon className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{t.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {m.label}
                      {t.depends_on?.length ? ` · after ${t.depends_on.join(", ")}` : ""}
                      {t.condition ? " · conditional" : ""}
                    </p>
                  </div>
                  <button
                    aria-label={`Edit ${t.name}`}
                    onClick={() => setEditing({ index: i, tool: t })}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    aria-label={`Remove ${t.name}`}
                    onClick={() => remove(i)}
                    disabled={isSaving}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editing && editing.index === null && (
        <ToolForm
          key="new-form"
          tool={editing.tool}
          others={tools}
          kind={kind}
          isNew
          isSaving={isSaving}
          onCancel={() => setEditing(null)}
          onSubmit={submit}
        />
      )}

      {!editing && (
        <div className="relative">
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setMenuOpen((v) => !v)}>
            Add function
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", menuOpen && "rotate-180")} />
          </Button>
          {menuOpen && (
            <div className="absolute z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
              {addKinds.map((k) => {
                const m = toolMeta(k);
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setMenuOpen(false);
                      setEditing({ index: null, tool: newTool(k, tools) });
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <m.icon className="w-4 h-4 text-gray-400" />
                    {m.label}
                  </button>
                );
              })}
              <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100 mt-1">
                CRM and calendar integrations are connected in Retell, then show up here to edit.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { ToolKind };
