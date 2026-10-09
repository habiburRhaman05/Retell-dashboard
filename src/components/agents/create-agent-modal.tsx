"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Plus,
  Braces,
  Workflow,
  ArrowDown,
  FileText,
  Mic,
  Flag,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/layout/toast";
import { useCreateAgentFromTemplate } from "@/hooks/use-agents";
import {
  AGENT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  fillTemplate,
  type AgentTemplate,
  type TemplateCategory,
} from "@/lib/agent-templates";
import { VoiceField, LanguageField } from "./voice-language-fields";

type AgentType = "single" | "flow";
type Channel = "voice" | "text";

export function CreateAgentModal({
  locationId,
  onClose,
}: {
  locationId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const createAgent = useCreateAgentFromTemplate(locationId);

  const [channel, setChannel] = useState<Channel>("voice");
  const [type, setType] = useState<AgentType>("single");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [voiceId, setVoiceId] = useState("retell-Cimo");
  const [language, setLanguage] = useState<string | string[]>("en-US");
  const [nameError, setNameError] = useState<string | null>(null);

  const busy = createAgent.isPending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const templates = useMemo(
    () =>
      AGENT_TEMPLATES.filter(
        (t) => (type === "single" || !!t.flow) && (category === "all" || t.category === category)
      ),
    [type, category]
  );

  const selected = templateId ? AGENT_TEMPLATES.find((t) => t.id === templateId) : undefined;

  const switchType = (next: AgentType) => {
    setType(next);
    // A template that has no flow version cannot stay selected.
    const t = templateId ? AGENT_TEMPLATES.find((x) => x.id === templateId) : undefined;
    if (next === "flow" && t && !t.flow) setTemplateId(null);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Give your agent a name");
      return;
    }
    setNameError(null);
    try {
      const agent = await createAgent.mutateAsync({
        name: trimmed,
        channel,
        type,
        templateId,
        businessName: businessName.trim() || undefined,
        voiceId: channel === "voice" ? voiceId : undefined,
        language,
      });
      toast("Agent created", "success");
      onClose();
      router.push(`/retell/${locationId}/agents/${agent.agent_id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create agent", "error");
    }
  };

  const types: { key: AgentType; label: string; description: string; icon: typeof Braces; tint: string }[] = [
    {
      key: "single",
      label: "Single prompt",
      description: "Easy to start. Simple, free-form conversations.",
      icon: Braces,
      tint: "bg-emerald-500",
    },
    {
      key: "flow",
      label: "Conversational flow",
      description: "Production-ready, deterministic conversations.",
      icon: Workflow,
      tint: "bg-violet-500",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create agent"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[min(800px,94vh)] flex flex-col animate-slide-up"
      >
        <div className="flex items-center justify-between px-6 h-14 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Create agent</h2>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Left: type + templates */}
          <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5 space-y-6">
            <div>
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Channel</p>
              <div className="inline-flex p-1 rounded-xl bg-gray-100">
                {([
                  { key: "voice", label: "Voice agent", icon: Mic },
                  { key: "text", label: "Text agent", icon: MessageSquare },
                ] as const).map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setChannel(c.key)}
                      aria-pressed={channel === c.key}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-all",
                        channel === c.key
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {types.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => switchType(t.key)}
                      aria-pressed={active}
                      className={cn(
                        "text-left rounded-xl border p-4 transition-all",
                        active
                          ? "border-brand-500 ring-1 ring-brand-500/30 bg-brand-50/30"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={cn("w-7 h-7 rounded-lg text-white flex items-center justify-center", t.tint)}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="text-[14px] font-semibold text-gray-900">{t.label}</span>
                      </div>
                      <p className="text-[12px] text-gray-500 mt-2">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Templates</p>
              <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-gray-200 mb-4">
                {[{ key: "all" as const, label: "All" }, ...TEMPLATE_CATEGORIES].map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={cn(
                      "px-3 pb-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                      category === c.key
                        ? "border-brand-500 text-brand-600"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <button
                  onClick={() => setTemplateId(null)}
                  aria-pressed={templateId === null}
                  className={cn(
                    "text-left rounded-xl border border-dashed p-4 transition-all min-h-[112px]",
                    templateId === null
                      ? "border-brand-500 bg-brand-50/30 ring-1 ring-brand-500/20"
                      : "border-gray-300 hover:border-gray-400"
                  )}
                >
                  <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center mb-3">
                    <Plus className="w-4 h-4" />
                  </span>
                  <p className="text-[13px] font-semibold text-gray-900">Build from scratch</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">Start with a blank agent</p>
                </button>

                {templates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    type={type}
                    active={templateId === t.id}
                    onSelect={() => setTemplateId(t.id)}
                  />
                ))}
              </div>

              {templates.length === 0 && (
                <p className="text-[13px] text-gray-500 text-center py-8">
                  No templates in this category for this agent type yet.
                </p>
              )}
            </div>
          </div>

          {/* Right: details + preview */}
          <div className="lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50/60 overflow-y-auto px-5 py-5 space-y-5">
            <div className="space-y-3">
              <p className="text-[12px] font-semibold text-gray-700">Details</p>
              <div>
                <label htmlFor="agent-name" className="text-[12px] text-gray-600 mb-1 block">
                  Agent name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="agent-name"
                  value={name}
                  placeholder="e.g. Front desk assistant"
                  error={nameError ?? undefined}
                  disabled={busy}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
              <div>
                <label htmlFor="business-name" className="text-[12px] text-gray-600 mb-1 block">
                  Business name <span className="text-gray-400">(optional)</span>
                </label>
                <Input
                  id="business-name"
                  value={businessName}
                  placeholder="Used in the greeting and prompt"
                  disabled={busy}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              {channel === "voice" && (
                <div>
                  <p className="text-[12px] text-gray-600 mb-1">Voice</p>
                  <VoiceField value={voiceId} onSave={(v) => setVoiceId(v)} />
                </div>
              )}
              <div>
                <p className="text-[12px] text-gray-600 mb-1">Language</p>
                <LanguageField value={language} onSave={(v) => setLanguage(v)} />
              </div>
            </div>

            <TemplatePreview
              template={selected}
              type={type}
              agent={name.trim()}
              business={businessName.trim()}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-gray-200 shrink-0">
          <p className="text-[12px] text-gray-500 truncate">
            {selected ? `Template: ${selected.name}` : "Blank agent"} ·{" "}
            {type === "flow" ? "Conversational flow" : "Single prompt"} ·{" "}
            {channel === "text" ? "Text agent" : "Voice agent"}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} disabled={busy} onClick={submit}>
              {busy ? "Creating..." : "Create agent"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  type,
  active,
  onSelect,
}: {
  template: AgentTemplate;
  type: AgentType;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "text-left rounded-xl border p-4 transition-all min-h-[112px] bg-white",
        active
          ? "border-brand-500 ring-1 ring-brand-500/20"
          : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
      )}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Braces className="w-3.5 h-3.5" />
        </span>
        {template.flow && (
          <span
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center",
              type === "flow" ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-400"
            )}
            title="Also available as a conversational flow"
          >
            <Workflow className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <p className="text-[13px] font-semibold text-gray-900">{template.name}</p>
      <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
    </button>
  );
}

function TemplatePreview({
  template,
  type,
  agent,
  business,
}: {
  template?: AgentTemplate;
  type: AgentType;
  agent: string;
  business: string;
}) {
  if (!template) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-center">
        <FileText className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
        <p className="text-[12px] text-gray-500">
          Pick a template to preview it here, or start with a blank agent and write your own prompt
          later.
        </p>
      </div>
    );
  }

  const a = agent || "Your agent";
  const b = business || "your business";

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[13px] font-semibold text-gray-900">{template.name}</p>
        <p className="text-[12px] text-gray-500">{template.description}</p>
      </div>

      {type === "flow" && template.flow ? (
        <ol className="rounded-xl border border-gray-200 bg-white p-3 space-y-1.5">
          {template.flow.nodes.map((n, i) => (
            <li key={n.id}>
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0",
                    n.end ? "bg-gray-100 text-gray-500" : "bg-violet-100 text-violet-600"
                  )}
                >
                  {n.end ? <Flag className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-gray-800">{n.name}</p>
                  {n.prompt && (
                    <p className="text-[11px] text-gray-500 line-clamp-2">
                      {fillTemplate(n.prompt, a, b)}
                    </p>
                  )}
                </div>
              </div>
              {i < template.flow!.nodes.length - 1 && (
                <ArrowDown className="w-3 h-3 text-gray-300 ml-1 my-0.5" />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-[11px] font-medium text-gray-500 mb-1">Welcome message</p>
            <p className="text-[12px] text-gray-800">{fillTemplate(template.beginMessage, a, b)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-[11px] font-medium text-gray-500 mb-1">Prompt</p>
            <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
              {fillTemplate(template.prompt, a, b)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
