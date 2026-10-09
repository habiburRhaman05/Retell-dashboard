"use client";

import { useParams, useRouter } from "next/navigation";
import { useLocation } from "@/providers/location-provider";
import { useAgentDetail } from "@/hooks/use-agent-detail";
import { useDeleteAgent, useUpdateAgent } from "@/hooks/use-agents";
import { useToast } from "@/components/layout/toast";
import { cn, timeAgo } from "@/lib/utils";
import {
  SettingsPanel,
  SliderSetting,
  ToggleSetting,
  SelectSetting,
  RadioGroupSetting,
  NumberSetting,
  TextSetting,
  TagListSetting,
} from "@/components/agents/field-controls";
import { PronunciationEditor } from "@/components/agents/pronunciation-editor";
import { PostCallAnalysisEditor } from "@/components/agents/post-call-analysis-editor";
import { FunctionsEditor } from "@/components/agents/functions-editor";
import { KnowledgeBaseSelector } from "@/components/agents/knowledge-base-selector";
import { TestCallPanel } from "@/components/agents/test-call-panel";
import { TestChatPanel } from "@/components/agents/test-chat-panel";
import { VersionHistoryPanel } from "@/components/agents/version-history-panel";
import { InlineSelect } from "@/components/agents/inline-select";
import { WorkflowEditor, type WorkflowEditorHandle } from "@/components/agents/workflow-editor";
import { SaveButton } from "@/components/agents/save-button";
import { useAgentFlow, useUpdateAgentFlow } from "@/hooks/use-agent-flow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LLM_MODEL_OPTIONS, S2S_MODEL_OPTIONS } from "@/lib/constants";
import { modelIcon } from "@/components/agents/model-icons";
import { getTimezoneOptions } from "@/lib/timezones";
import { VoiceField, LanguageField } from "@/components/agents/voice-language-fields";
import {
  ArrowLeft,
  Trash2,
  Copy,
  Phone,
  BarChart3,
  BrainCircuit,
  Mic,
  Settings2,
  Loader2,
  PhoneCall,
  History,
  Radio,
  Languages,
  Webhook,
  Database,
  Zap,
  BrainCog,
  FileText,
  MessageSquare,
  Workflow,
  Wand2,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RetellLlm, PronunciationEntry, PostCallAnalysisItem, RetellLlmTool } from "@/types/retell";

type TabKey = "workflow" | "prompt" | "voice" | "call" | "chat" | "tools" | "analysis" | "advanced";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "prompt", label: "Prompt", icon: FileText },
  { key: "voice", label: "Voice & Speech", icon: Mic },
  { key: "call", label: "Call", icon: Phone },
  { key: "tools", label: "Functions & Knowledge", icon: Zap },
  { key: "analysis", label: "Analysis & Webhooks", icon: BarChart3 },
  { key: "advanced", label: "Advanced", icon: Settings2 },
];

const FLOW_TABS: typeof TABS = [
  { key: "workflow", label: "Workflow", icon: Workflow },
  { key: "voice", label: "Voice & Speech", icon: Mic },
  { key: "call", label: "Call", icon: Phone },
  { key: "tools", label: "Knowledge", icon: BrainCircuit },
  { key: "analysis", label: "Analysis & Webhooks", icon: BarChart3 },
  { key: "advanced", label: "Advanced", icon: Settings2 },
];

const CHAT_TABS: typeof TABS = [
  { key: "prompt", label: "Prompt", icon: FileText },
  { key: "chat", label: "Chat settings", icon: MessageSquare },
  { key: "tools", label: "Functions & Knowledge", icon: Zap },
  { key: "analysis", label: "Analysis & Webhooks", icon: BarChart3 },
  { key: "advanced", label: "Advanced", icon: Settings2 },
];

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export default function AgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const { locationId } = useLocation();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const agentId = params.agentId;

  const { data: agent, isLoading, error } = useAgentDetail(agentId, locationId);
  const deleteAgentMut = useDeleteAgent(locationId);
  const updateAgentMut = useUpdateAgent(locationId);

  const llmId = agent?.response_engine?.llm_id;
  const { data: llm, isLoading: llmLoading } = useQuery<RetellLlm>({
    queryKey: ["llm", llmId],
    queryFn: () => fetchJson<RetellLlm>(`/api/retell/llm/${llmId}`),
    enabled: !!llmId,
  });

  const isFlow = agent?.response_engine?.type === "conversation-flow";
  const {
    data: flow,
    isLoading: flowLoading,
    error: flowError,
    refetch: refetchFlow,
  } = useAgentFlow(agentId, locationId, isFlow);
  const updateFlowMut = useUpdateAgentFlow(agentId, locationId);

  const updateLlmMut = useMutation({
    mutationFn: (data: Partial<RetellLlm>) =>
      fetchJson<RetellLlm>(`/api/retell/llm/${llmId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llm", llmId] });
    },
  });

  const [prompt, setPrompt] = useState("");
  const [beginMessage, setBeginMessage] = useState("");
  const [startSpeaker, setStartSpeaker] = useState<"agent" | "user">("agent");
  // "dynamic" = begin_message is null and the model writes the greeting itself.
  const [messageMode, setMessageMode] = useState<"custom" | "dynamic">("custom");
  const [showTestCall, setShowTestCall] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showTestChat, setShowTestChat] = useState(false);
  const [tab, setTab] = useState<TabKey>("prompt");
  const flowRef = useRef<WorkflowEditorHandle>(null);
  const [flowDirty, setFlowDirty] = useState(false);

  // Sync local editor state whenever a *different* LLM loads (initial load,
  // or navigating to another agent) - not on every background refetch, so
  // in-progress edits aren't clobbered. This runs during render per React's
  // "adjusting state when a prop changes" guidance rather than in an effect.
  const [syncedLlmId, setSyncedLlmId] = useState<string | undefined>(undefined);
  if (llm && llm.llm_id !== syncedLlmId) {
    setSyncedLlmId(llm.llm_id);
    setPrompt(llm.general_prompt || "");
    setBeginMessage(llm.begin_message || "");
    setStartSpeaker(llm.start_speaker ?? "agent");
    setMessageMode(llm.begin_message === null ? "dynamic" : "custom");
  }

  const savedMode = llm && llm.begin_message === null ? "dynamic" : "custom";
  const hasChanges = llm
    ? prompt !== (llm.general_prompt || "") ||
      beginMessage !== (llm.begin_message || "") ||
      startSpeaker !== (llm.start_speaker ?? "agent") ||
      messageMode !== savedMode
    : false;

  const handleSavePrompt = useCallback(async () => {
    if (!llmId) return;
    try {
      await updateLlmMut.mutateAsync({
        general_prompt: prompt,
        start_speaker: startSpeaker,
        // null lets the model generate the opening line; "" waits for the caller.
        begin_message:
          startSpeaker === "user" ? "" : messageMode === "dynamic" ? null : beginMessage,
      });
      toast("Prompt saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save prompt", "error");
    }
  }, [llmId, prompt, beginMessage, startSpeaker, messageMode, updateLlmMut, toast]);

  // One Save button in the header covers whichever editor is on screen: the
  // prompt and welcome message, or the workflow canvas for flow agents.
  const dirty = isFlow ? flowDirty : hasChanges;
  const saving = isFlow ? updateFlowMut.isPending : updateLlmMut.isPending;
  const saveCurrent = () => {
    if (!dirty || saving) return;
    if (isFlow) void flowRef.current?.save();
    else void handleSavePrompt();
  };
  const saveRef = useRef(saveCurrent);
  useEffect(() => {
    saveRef.current = saveCurrent;
  });

  // Ctrl/Cmd+S saves, and leaving the page with unsaved edits asks first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const handleUpdateAgent = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await updateAgentMut.mutateAsync({ agentId, data });
        queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
        toast("Settings saved", "success");
        return true;
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to save settings", "error");
        return false;
      }
    },
    [agentId, updateAgentMut, queryClient, toast]
  );

  // Realtime (speech to speech) models live in `s2s_model` and exclude `model`,
  // so switching between the two kinds clears the other field.
  const buildModelOptions = () => {
    const base: { value: string; label: string; group?: string; icon: React.ComponentType<{ className?: string }> }[] = [
      ...LLM_MODEL_OPTIONS.map((o) => ({ ...o, icon: modelIcon(o.value) })),
      ...S2S_MODEL_OPTIONS.map((o) => ({ ...o, value: `s2s:${o.value}`, icon: modelIcon(o.value) })),
    ];
    const current = llm?.s2s_model ? `s2s:${llm.s2s_model}` : llm?.model ?? flow?.model_choice?.model;
    // Agents created elsewhere may use a model that is not in our list.
    if (current && !base.some((o) => o.value === current)) {
      base.unshift({
        value: current,
        label: current.replace(/^s2s:/, ""),
        group: "Current",
        icon: modelIcon(current),
      });
    }
    return base;
  };
  const modelOptions = buildModelOptions();

  const handleUpdateLlm = useCallback(
    async (data: Partial<RetellLlm>) => {
      try {
        await updateLlmMut.mutateAsync(data);
        toast("Saved", "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to save", "error");
      }
    },
    [updateLlmMut, toast]
  );

  const handleModelChange = (v: string) =>
    v.startsWith("s2s:")
      ? handleUpdateLlm({ s2s_model: v.slice(4), model: null })
      : handleUpdateLlm({ model: v, s2s_model: null });

  const handleDelete = async () => {
    if (!confirm(`Delete "${agent?.agent_name || "Unnamed"}"? This cannot be undone.`))
      return;
    try {
      await deleteAgentMut.mutateAsync(agentId);
      toast("Agent deleted", "success");
      router.push(`/retell/${locationId}/agents`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete agent", "error");
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(agentId);
    toast("Agent ID copied", "info");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-12 text-center">
        <p className="text-red-500 text-sm">
          {error instanceof Error ? error.message : "Agent not found"}
        </p>
        <Link
          href={`/retell/${locationId}/agents`}
          className="text-brand-500 text-sm mt-3 inline-block hover:underline"
        >
          Back to Agents
        </Link>
      </div>
    );
  }

  const timezoneOptions = [
    { value: "", label: "No timezone set" },
    ...getTimezoneOptions(),
  ];
  const isChat = agent.channel === "chat";
  const currentTab: TabKey = isFlow && tab === "prompt" ? "workflow" : tab;
  const timezoneBlock = (
    <div className="px-5 py-3.5 border-t border-gray-50 first:border-0">
      <p className="text-[13px] font-medium text-gray-700">Current time awareness</p>
      <p className="text-[11px] text-gray-400 mt-0.5 mb-1.5">
        Set the agent&apos;s timezone so it understands today, tomorrow and business hours
        correctly.
      </p>
      <InlineSelect
        icon={Clock}
        value={agent.timezone ?? ""}
        options={timezoneOptions}
        searchable
        isSaving={updateAgentMut.isPending}
        onSave={(v) => handleUpdateAgent({ timezone: v || null })}
      />
    </div>
  );
  const tabs = isChat ? CHAT_TABS : isFlow ? FLOW_TABS : TABS;
  const voicemailEnabled = !!agent.voicemail_option;
  const voicemailActionType = agent.voicemail_option?.action?.type ?? "hangup";
  const ivrEnabled = !!agent.ivr_option;
  const callScreeningEnabled = !!agent.call_screening_option;
  const dtmfOptions = agent.user_dtmf_options ?? null;

  return (
    <div className="h-full flex flex-col">
      {/* Hero header */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 shrink-0">
        <div className="max-w-none mx-auto pt-4 pb-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/retell/${locationId}/agents`}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
              aria-label="Back to agents"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </Link>

            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-base font-semibold shadow-sm shrink-0">
              {(agent.agent_name || "A").charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900 truncate tracking-tight">
                  {agent.agent_name || "Unnamed Agent"}
                </h1>
                <Badge variant={agent.is_published ? "success" : "warning"} dot>
                  {agent.is_published ? "Published" : "Draft"}
                </Badge>
                <span className="text-[11px] text-gray-400 font-medium">v{agent.version}</span>
                {isChat && <Badge variant="info">Text agent</Badge>}
              </div>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Modified {timeAgo(agent.last_modification_timestamp)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <SaveButton dirty={dirty} saving={saving} onClick={saveCurrent} />
              {!isChat && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={PhoneCall}
                  onClick={() => setShowTestCall(true)}
                >
                  Test Call
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                icon={MessageSquare}
                onClick={() => setShowTestChat(true)}
              >
                <span className="hidden sm:inline">{isChat ? "Test chat" : "Test LLM"}</span>
              </Button>
              {!isChat && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={History}
                  onClick={() => setShowVersions(true)}
                >
                  <span className="hidden sm:inline">Versions & Publish</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={Copy}
                onClick={copyId}
                className="hidden md:inline-flex font-mono"
              >
                ID
              </Button>
              <Button size="sm" variant="danger" icon={Trash2} onClick={handleDelete}>
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          </div>

          {/* Model / voice / language */}
          <div className={cn("mt-4 grid grid-cols-1 gap-3", isChat ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
            {isFlow ? (
              flow ? (
                <InlineSelect
                  icon={BrainCog}
                  value={flow.model_choice?.model ?? ""}
                  options={modelOptions}
                  searchable
                  isSaving={updateFlowMut.isPending}
                  onSave={(v) =>
                    updateFlowMut
                      .mutateAsync({ model_choice: { ...flow.model_choice, model: v } })
                      .then(() => toast("Model updated", "success"))
                      .catch((err) =>
                        toast(err instanceof Error ? err.message : "Failed to update model", "error")
                      )
                  }
                />
              ) : (
                <div className="h-9 rounded-lg bg-gray-100 animate-pulse" />
              )
            ) :             llm ? (
              <InlineSelect
                icon={BrainCog}
                value={llm.s2s_model ? `s2s:${llm.s2s_model}` : llm.model ?? ""}
                options={modelOptions}
                searchable
                isSaving={updateLlmMut.isPending}
                onSave={handleModelChange}
              />
            ) : (
              <div className="h-9 rounded-lg bg-gray-100 animate-pulse" />
            )}
            {!isChat && (
              <VoiceField
                value={agent.voice_id}
                isSaving={updateAgentMut.isPending}
                onSave={(v) => handleUpdateAgent({ voice_id: v })}
              />
            )}
            <LanguageField
              value={agent.language}
              isSaving={updateAgentMut.isPending}
              onSave={(v) => handleUpdateAgent({ language: v })}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 shrink-0">
        <div className="max-w-none mx-auto flex items-center gap-1 overflow-x-auto" role="tablist">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = currentTab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3.5 h-11 text-[13px] font-medium whitespace-nowrap transition-colors",
                  active ? "text-brand-600" : "text-gray-500 hover:text-gray-800"
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {active && (
                  <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
                )}
              </button>
            );
          })}
          {(updateAgentMut.isPending || updateLlmMut.isPending) && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-brand-600 font-medium shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto bg-gray-50/70">
        <div className="max-w-none mx-auto px-4 lg:px-6 py-6">
          {currentTab === "workflow" && isFlow && (
            <div className="animate-fade-in">
              {flowLoading && (
                <div className="h-[420px] flex flex-col items-center justify-center gap-3 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                  <p className="text-sm">Loading workflow from Retell...</p>
                </div>
              )}
              {flowError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                  <p className="text-sm font-medium text-red-700">Could not load the workflow</p>
                  <p className="text-xs text-red-600 mt-1">
                    {flowError instanceof Error ? flowError.message : "Something went wrong"}
                  </p>
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => refetchFlow()}>
                    Retry
                  </Button>
                </div>
              )}
              {flow && (
                <WorkflowEditor
                  ref={flowRef}
                  onDirtyChange={setFlowDirty}
                  flow={flow}
                  isSaving={updateFlowMut.isPending}
                  onSave={async (patch) => {
                    await updateFlowMut.mutateAsync(patch);
                    toast("Workflow saved", "success");
                  }}
                />
              )}
            </div>
          )}

          {currentTab === "prompt" && !isFlow && (
            <div className="space-y-4 animate-fade-in">
              <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
                  <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[14px] font-semibold text-gray-900">Agent prompt</h2>
                    <p className="text-[12px] text-gray-500">
                      Describe who the agent is, how it speaks and what it should do
                    </p>
                  </div>
                  {hasChanges && (
                    <Badge variant="warning" dot>
                      Unsaved changes
                    </Badge>
                  )}
                </div>
                {llmLoading ? (
                  <div className="h-[420px] flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[12px]">Loading prompt...</span>
                  </div>
                ) : (
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter the agent's system prompt..."
                    spellCheck={false}
                    className="block w-full h-[calc(100vh-480px)] min-h-[320px] px-5 py-4 text-[14px] text-gray-800 leading-relaxed resize-y focus:outline-none placeholder:text-gray-300"
                  />
                )}
                <div className="flex items-center justify-between px-5 py-2 border-t border-gray-100 bg-gray-50/60 text-[11px] text-gray-400">
                  <span>{prompt.length.toLocaleString()} characters</span>
                  <span>~{Math.ceil(prompt.length / 4).toLocaleString()} tokens</span>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold text-gray-900">Welcome message</h2>
                  <span className="text-[11px] text-gray-400">
                    Saved with the prompt using Save at the top
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[12px] text-gray-600 mb-1">Who speaks first</p>
                    <InlineSelect
                      icon={MessageSquare}
                      value={startSpeaker}
                      options={[
                        { value: "agent", label: "AI speaks first" },
                        { value: "user", label: "User speaks first" },
                      ]}
                      onSave={(v) => setStartSpeaker(v as "agent" | "user")}
                    />
                  </div>
                  {startSpeaker === "agent" && (
                    <div>
                      <p className="text-[12px] text-gray-600 mb-1">Message type</p>
                      <InlineSelect
                        icon={Wand2}
                        value={messageMode}
                        options={[
                          { value: "dynamic", label: "Dynamic message (AI generated)" },
                          { value: "custom", label: "Custom message" },
                        ]}
                        onSave={(v) => setMessageMode(v as "custom" | "dynamic")}
                      />
                    </div>
                  )}
                </div>

                {startSpeaker === "agent" && messageMode === "custom" && (
                  <Input
                    type="text"
                    value={beginMessage}
                    onChange={(e) => setBeginMessage(e.target.value)}
                    placeholder="Hi, how can I help you today?"
                  />
                )}
                {startSpeaker === "agent" && messageMode === "dynamic" && (
                  <p className="text-[12px] text-gray-500 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    The model writes the opening line from your prompt. Short openings (under 10
                    seconds) are billed as 10 seconds.
                  </p>
                )}
                {startSpeaker === "user" && (
                  <p className="text-[12px] text-gray-500 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    The agent stays quiet until the caller speaks.
                  </p>
                )}

                {!isChat && (
                  <SliderSetting
                    label="Pause before speaking (sec)"
                    value={(agent.begin_message_delay_ms ?? 0) / 1000}
                    min={0}
                    max={5}
                    step={0.5}
                    onSave={(v) => handleUpdateAgent({ begin_message_delay_ms: v * 1000 })}
                  />
                )}
              </section>
            </div>
          )}

          {currentTab === "voice" && (
            <div className="space-y-4 animate-fade-in">
            <SettingsPanel icon={Mic} title="Speech settings"
              description="Voice delivery, pacing and interruption behavior"
            >
              <SliderSetting
                label="Voice Speed"
                value={agent.voice_speed ?? 1}
                min={0.5}
                max={2}
                step={0.1}
                onSave={(v) => handleUpdateAgent({ voice_speed: v })}
              />
              <SliderSetting
                label="Voice Temperature"
                value={agent.voice_temperature ?? 1}
                min={0}
                max={2}
                step={0.1}
                onSave={(v) => handleUpdateAgent({ voice_temperature: v })}
              />
              <SliderSetting
                label="Volume"
                value={agent.volume ?? 1}
                min={0}
                max={2}
                step={0.1}
                onSave={(v) => handleUpdateAgent({ volume: v })}
              />
              <SliderSetting
                label="Responsiveness"
                value={agent.responsiveness ?? 1}
                min={0}
                max={1}
                step={0.05}
                onSave={(v) => handleUpdateAgent({ responsiveness: v })}
              />
              <SliderSetting
                label="Interruption Sensitivity"
                value={agent.interruption_sensitivity ?? 1}
                min={0}
                max={1}
                step={0.05}
                onSave={(v) => handleUpdateAgent({ interruption_sensitivity: v })}
              />
              <ToggleSetting
                label="Dynamic Voice Speed"
                description="Automatically match the caller's pace"
                value={agent.enable_dynamic_voice_speed ?? false}
                onSave={(v) => handleUpdateAgent({ enable_dynamic_voice_speed: v })}
              />
              <ToggleSetting
                label="Backchannel"
                description="Agent says 'uh-huh', 'yeah' etc."
                value={agent.enable_backchannel ?? false}
                onSave={(v) => handleUpdateAgent({ enable_backchannel: v })}
              />
              {agent.enable_backchannel && (
                <TagListSetting
                  label="Backchannel Words"
                  value={agent.backchannel_words ?? []}
                  placeholder="e.g. mm-hmm"
                  onSave={(v) => handleUpdateAgent({ backchannel_words: v })}
                />
              )}
              <TagListSetting
                label="Fallback Voices"
                description="Used automatically if the primary voice provider has an outage"
                value={agent.fallback_voice_ids ?? []}
                placeholder="Voice ID"
                onSave={(v) => handleUpdateAgent({ fallback_voice_ids: v })}
              />
            </SettingsPanel>

            <SettingsPanel icon={Radio} title="Realtime transcription"
              description="How caller speech is cleaned and transcribed"
            >
              <RadioGroupSetting
                label="Denoising Mode"
                value={agent.denoising_mode ?? "noise-cancellation"}
                options={[
                  { value: "noise-cancellation", label: "Remove noise" },
                  {
                    value: "noise-and-background-speech-cancellation",
                    label: "Remove noise + background speech",
                  },
                  { value: "no-denoising", label: "No denoising" },
                ]}
                onSave={(v) => handleUpdateAgent({ denoising_mode: v })}
              />
              <RadioGroupSetting
                label="Transcription Mode"
                value={agent.stt_mode ?? "fast"}
                options={[
                  { value: "fast", label: "Optimize for speed" },
                  { value: "accurate", label: "Optimize for accuracy" },
                ]}
                onSave={(v) => handleUpdateAgent({ stt_mode: v })}
              />
              <SelectSetting
                label="Vocabulary"
                value={agent.vocab_specialization ?? "general"}
                options={[
                  { value: "general", label: "General" },
                  { value: "medical", label: "Medical" },
                ]}
                onSave={(v) => handleUpdateAgent({ vocab_specialization: v })}
              />
              <TagListSetting
                label="Boosted Keywords"
                description="Bias the transcriber toward these words"
                value={agent.boosted_keywords ?? []}
                placeholder="e.g. Acme Corp"
                onSave={(v) => handleUpdateAgent({ boosted_keywords: v })}
              />
            </SettingsPanel>
            </div>
          )}
          {currentTab === "call" && (
            <div className="space-y-4 animate-fade-in">
            <SettingsPanel icon={Phone} title="Call settings"
              description="Limits, voicemail, IVR and keypad handling"
            >
              <SliderSetting
                label="Max Call Duration (min)"
                value={(agent.max_call_duration_ms ?? 3600000) / 60000}
                min={1}
                max={120}
                step={1}
                onSave={(v) => handleUpdateAgent({ max_call_duration_ms: v * 60000 })}
              />
              <SliderSetting
                label="End After Silence (sec)"
                value={(agent.end_call_after_silence_ms ?? 600000) / 1000}
                min={10}
                max={600}
                step={10}
                onSave={(v) => handleUpdateAgent({ end_call_after_silence_ms: v * 1000 })}
              />
              <SliderSetting
                label="Ring Duration (sec)"
                value={(agent.ring_duration_ms ?? 30000) / 1000}
                min={5}
                max={300}
                step={5}
                onSave={(v) => handleUpdateAgent({ ring_duration_ms: v * 1000 })}
              />
              <SliderSetting
                label="First Message Delay (sec)"
                value={(agent.begin_message_delay_ms ?? 0) / 1000}
                min={0}
                max={5}
                step={0.5}
                onSave={(v) => handleUpdateAgent({ begin_message_delay_ms: v * 1000 })}
              />
              {timezoneBlock}
              <SelectSetting
                label="Ambient Sound"
                value={agent.ambient_sound || ""}
                options={[
                  { value: "", label: "None" },
                  { value: "coffee-shop", label: "Coffee Shop" },
                  { value: "convention-hall", label: "Convention Hall" },
                  { value: "summer-outdoor", label: "Summer Outdoor" },
                  { value: "mountain-outdoor", label: "Mountain Outdoor" },
                  { value: "static-noise", label: "Static Noise" },
                  { value: "call-center", label: "Call Center" },
                ]}
                onSave={(v) => handleUpdateAgent({ ambient_sound: v || null })}
              />
              {agent.ambient_sound && (
                <SliderSetting
                  label="Ambient Sound Volume"
                  value={agent.ambient_sound_volume ?? 1}
                  min={0}
                  max={2}
                  step={0.1}
                  onSave={(v) => handleUpdateAgent({ ambient_sound_volume: v })}
                />
              )}

              <ToggleSetting
                label="DNC Detection"
                description="Recognize requests to stop calling and mark the contact do-not-call"
                value={agent.enable_dnc_detection ?? false}
                onSave={(v) => handleUpdateAgent({ enable_dnc_detection: v })}
              />

              <ToggleSetting
                label="Voicemail Detection"
                description="Hang up or leave a message if voicemail is detected"
                value={voicemailEnabled}
                onSave={(v) =>
                  handleUpdateAgent({
                    voicemail_option: v ? { action: { type: "hangup" } } : null,
                  })
                }
              />
              {voicemailEnabled && (
                <>
                  <SelectSetting
                    label="On Voicemail"
                    value={voicemailActionType}
                    options={[
                      { value: "hangup", label: "Hang up" },
                      { value: "static_text", label: "Leave a fixed message" },
                      { value: "prompt", label: "Leave an AI-composed message" },
                    ]}
                    onSave={(v) =>
                      handleUpdateAgent({
                        voicemail_option: { action: { type: v, text: agent.voicemail_option?.action?.text } },
                      })
                    }
                  />
                  {voicemailActionType !== "hangup" && (
                    <TextSetting
                      label={voicemailActionType === "static_text" ? "Message" : "Instruction"}
                      value={agent.voicemail_option?.action?.text || ""}
                      multiline
                      placeholder={
                        voicemailActionType === "static_text"
                          ? "Hey {{user_name}}, sorry we couldn't reach you..."
                          : "Summarize the call and ask the user to call back"
                      }
                      onSave={(v) =>
                        handleUpdateAgent({
                          voicemail_option: { action: { type: voicemailActionType, text: v } },
                        })
                      }
                    />
                  )}
                </>
              )}

              <ToggleSetting
                label="IVR Hangup"
                description="Hang up automatically if an IVR system is detected"
                value={ivrEnabled}
                onSave={(v) =>
                  handleUpdateAgent({ ivr_option: v ? { action: { type: "hangup" } } : null })
                }
              />

              <ToggleSetting
                label="Call Screen Handling"
                description="Give the agent an identity and purpose for iOS/Android call screening"
                value={callScreeningEnabled}
                onSave={(v) =>
                  handleUpdateAgent({
                    call_screening_option: v ? { agent_identity: "", call_purpose: "" } : null,
                  })
                }
              />
              {callScreeningEnabled && (
                <>
                  <TextSetting
                    label="Agent Identity"
                    value={agent.call_screening_option?.agent_identity || ""}
                    placeholder="e.g. Acme Health scheduling team"
                    onSave={(v) =>
                      handleUpdateAgent({
                        call_screening_option: {
                          ...agent.call_screening_option,
                          agent_identity: v,
                        },
                      })
                    }
                  />
                  <TextSetting
                    label="Call Purpose"
                    value={agent.call_screening_option?.call_purpose || ""}
                    placeholder="e.g. confirming your appointment for tomorrow"
                    onSave={(v) =>
                      handleUpdateAgent({
                        call_screening_option: {
                          ...agent.call_screening_option,
                          call_purpose: v,
                        },
                      })
                    }
                  />
                </>
              )}

              <ToggleSetting
                label="Allow User DTMF"
                description="Let caller press phone keys"
                value={agent.allow_user_dtmf ?? true}
                onSave={(v) => handleUpdateAgent({ allow_user_dtmf: v })}
              />
              {agent.allow_user_dtmf && (
                <>
                  <ToggleSetting
                    label="DTMF Can Interrupt Agent"
                    value={agent.allow_dtmf_interruption ?? false}
                    onSave={(v) => handleUpdateAgent({ allow_dtmf_interruption: v })}
                  />
                  <NumberSetting
                    label="Digit Limit"
                    description="Respond immediately once this many digits are entered (0 = off)"
                    value={dtmfOptions?.digit_limit ?? 0}
                    min={0}
                    max={20}
                    onSave={(v) =>
                      handleUpdateAgent({
                        user_dtmf_options: { ...dtmfOptions, digit_limit: v || null },
                      })
                    }
                  />
                  <SelectSetting
                    label="Termination Key"
                    value={dtmfOptions?.termination_key ?? ""}
                    options={[
                      { value: "", label: "None" },
                      ...["0","1","2","3","4","5","6","7","8","9","#","*"].map((k) => ({
                        value: k,
                        label: k,
                      })),
                    ]}
                    onSave={(v) =>
                      handleUpdateAgent({
                        user_dtmf_options: { ...dtmfOptions, termination_key: v || null },
                      })
                    }
                  />
                  <SliderSetting
                    label="Keypad Timeout (sec)"
                    value={(dtmfOptions?.timeout_ms ?? 2500) / 1000}
                    min={0.5}
                    max={10}
                    step={0.5}
                    onSave={(v) =>
                      handleUpdateAgent({
                        user_dtmf_options: { ...dtmfOptions, timeout_ms: v * 1000 },
                      })
                    }
                  />
                </>
              )}
            </SettingsPanel>
            </div>
          )}
          {currentTab === "chat" && isChat && (
            <div className="space-y-4 animate-fade-in">
              <SettingsPanel
                icon={MessageSquare}
                title="Chat settings"
                description="How long chats stay open and what happens when they end"
              >
                <NumberSetting
                  label="End chat after silence (minutes)"
                  description="Between 2 minutes and 72 hours (4320 minutes)"
                  value={Math.round((agent.end_chat_after_silence_ms ?? 3600000) / 60000)}
                  min={2}
                  max={4320}
                  suffix="min"
                  onSave={(v) => handleUpdateAgent({ end_chat_after_silence_ms: v * 60000 })}
                />
                <TextSetting
                  label="Auto-close message"
                  description="Shown when the chat is closed automatically"
                  value={agent.auto_close_message || ""}
                  multiline
                  placeholder="Thank you for chatting. The conversation has ended."
                  onSave={(v) => handleUpdateAgent({ auto_close_message: v })}
                />
                {timezoneBlock}
              </SettingsPanel>
            </div>
          )}
          {currentTab === "tools" && (
            <div className="space-y-4 animate-fade-in">
            {!isFlow && (
            <SettingsPanel icon={Zap} title="Functions"
              description="Tools the agent can call during a conversation"
            >
              {llmLoading ? (
                <div className="px-4 py-6 flex items-center justify-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-[12px]">Loading functions...</span>
                </div>
              ) : (
                <FunctionsEditor
                  tools={(llm?.general_tools ?? []) as RetellLlmTool[]}
                  isSaving={updateLlmMut.isPending}
                  onSave={(tools) => handleUpdateLlm({ general_tools: tools })}
                />
              )}
            </SettingsPanel>
            )}

            <SettingsPanel icon={BrainCircuit} title="Knowledge base & memory"
              description="Reference content and caller memory"
            >
              <ToggleSetting
                label="Contact Memory Read"
                description="Agent can read past interactions"
                value={agent.contact_memory_config?.enable_read ?? true}
                onSave={(v) =>
                  handleUpdateAgent({
                    contact_memory_config: {
                      ...agent.contact_memory_config,
                      enable_read: v,
                    },
                  })
                }
              />
              <ToggleSetting
                label="Contact Memory Update"
                description="Agent can store info about callers"
                value={agent.contact_memory_config?.enable_update ?? false}
                onSave={(v) =>
                  handleUpdateAgent({
                    contact_memory_config: {
                      ...agent.contact_memory_config,
                      enable_update: v,
                    },
                  })
                }
              />
              <div className="border-t border-gray-100">
                <KnowledgeBaseSelector
                  locationId={locationId}
                  attachedIds={(isFlow ? flow?.knowledge_base_ids : llm?.knowledge_base_ids) ?? []}
                  isLoading={isFlow ? flowLoading : llmLoading}
                  isSaving={isFlow ? updateFlowMut.isPending : updateLlmMut.isPending}
                  onSave={(ids) =>
                    isFlow
                      ? updateFlowMut
                          .mutateAsync({ knowledge_base_ids: ids })
                          .then(() => toast("Saved", "success"))
                          .catch((err) =>
                            toast(err instanceof Error ? err.message : "Failed to save", "error")
                          )
                      : handleUpdateLlm({ knowledge_base_ids: ids })
                  }
                />
              </div>
            </SettingsPanel>

            {!isChat && (
            <SettingsPanel icon={Languages} title="Pronunciation"
              description="Custom pronunciations for names and terms"
            >
              <PronunciationEditor
                entries={(agent.pronunciation_dictionary ?? []) as PronunciationEntry[]}
                isSaving={updateAgentMut.isPending}
                onSave={(entries) => handleUpdateAgent({ pronunciation_dictionary: entries })}
              />
            </SettingsPanel>
            )}
            </div>
          )}
          {currentTab === "analysis" && (
            <div className="space-y-4 animate-fade-in">
            <SettingsPanel icon={BarChart3} title={isChat ? "Post chat extraction" : "Post call extraction"}
              description={isChat ? "Structured data pulled from each chat" : "Structured data pulled from each call"}
            >
              <PostCallAnalysisEditor
                items={((isChat ? agent.post_chat_analysis_data : agent.post_call_analysis_data) ?? []) as PostCallAnalysisItem[]}
                isSaving={updateAgentMut.isPending}
                onSave={(items) =>
                  handleUpdateAgent(
                    isChat ? { post_chat_analysis_data: items } : { post_call_analysis_data: items }
                  )
                }
              />
            </SettingsPanel>

            <SettingsPanel icon={Webhook} title="Webhook"
              description="Send call events to your server"
            >
              <TextSetting
                label="Webhook URL"
                value={agent.webhook_url || ""}
                placeholder="https://your-server.com/webhook"
                onSave={(v) => handleUpdateAgent({ webhook_url: v || null })}
              />
              <TagListSetting
                label="Events"
                description={isChat ? "e.g. chat_started, chat_ended, chat_analyzed" : "e.g. call_started, call_ended, call_analyzed"}
                value={agent.webhook_events ?? []}
                placeholder="call_ended"
                onSave={(v) => handleUpdateAgent({ webhook_events: v })}
              />
            </SettingsPanel>
            </div>
          )}
          {currentTab === "advanced" && (
            <div className="space-y-4 animate-fade-in">
            <SettingsPanel icon={Database} title="Data & privacy"
              description="Storage, retention and access"
            >
              <SelectSetting
                label="Data Storage"
                value={agent.data_storage_setting ?? "everything"}
                options={[
                  { value: "everything", label: "Everything" },
                  { value: "everything_except_pii", label: "Everything except PII" },
                  { value: "basic_attributes_only", label: "Basic attributes only" },
                ]}
                onSave={(v) => handleUpdateAgent({ data_storage_setting: v })}
              />
              <NumberSetting
                label="Retention (days)"
                value={agent.data_storage_retention_days ?? 730}
                min={1}
                max={730}
                onSave={(v) => handleUpdateAgent({ data_storage_retention_days: v })}
              />
              <ToggleSetting
                label="Signed URLs"
                description="Require signed URLs for recordings and logs"
                value={agent.opt_in_signed_url ?? false}
                onSave={(v) => handleUpdateAgent({ opt_in_signed_url: v })}
              />
            </SettingsPanel>

            <SettingsPanel icon={Settings2} title="General"
              description="Identifiers for this agent"
            >
              <div className="px-4 py-3 space-y-3">
                <div>
                  <p className="text-[12px] text-gray-500 mb-1">Agent ID</p>
                  <p className="text-[11px] font-mono text-gray-600 bg-gray-50 px-2 py-1.5 rounded select-all">
                    {agent.agent_id}
                  </p>
                </div>
                {llmId && (
                  <div>
                    <p className="text-[12px] text-gray-500 mb-1">LLM ID</p>
                    <p className="text-[11px] font-mono text-gray-600 bg-gray-50 px-2 py-1.5 rounded select-all">
                      {llmId}
                    </p>
                  </div>
                )}
              </div>
            </SettingsPanel>

            <SettingsPanel icon={Settings2} title="Raw Config"
              description="Full agent JSON, read only"
            >
              <div className="p-3 overflow-auto max-h-[400px]">
                <pre className="text-[11px] text-gray-500 font-mono whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(agent, null, 2)}
                </pre>
              </div>
            </SettingsPanel>
            </div>
          )}
        </div>
      </div>

      {showTestCall && (
        <TestCallPanel
          agentId={agentId}
          agentName={agent.agent_name || ""}
          locationId={locationId}
          onClose={() => setShowTestCall(false)}
        />
      )}

      {showTestChat && (
        <TestChatPanel
          agentId={agentId}
          agentName={agent.agent_name || ""}
          locationId={locationId}
          onClose={() => setShowTestChat(false)}
        />
      )}

      {showVersions && !isChat && (
        <VersionHistoryPanel
          agentId={agentId}
          locationId={locationId}
          currentVersion={agent.version}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}
