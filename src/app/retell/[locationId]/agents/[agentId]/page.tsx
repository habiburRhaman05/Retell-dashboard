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
import { VersionHistoryPanel } from "@/components/agents/version-history-panel";
import { InlineSelect } from "@/components/agents/inline-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LLM_MODEL_OPTIONS, VOICE_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/constants";
import {
  ArrowLeft,
  Trash2,
  Copy,
  Save,
  Volume2,
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
  Globe,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RetellLlm, PronunciationEntry, PostCallAnalysisItem, RetellLlmTool } from "@/types/retell";

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
  const [showTestCall, setShowTestCall] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // Sync local editor state whenever a *different* LLM loads (initial load,
  // or navigating to another agent) — not on every background refetch, so
  // in-progress edits aren't clobbered. This runs during render per React's
  // "adjusting state when a prop changes" guidance rather than in an effect.
  const [syncedLlmId, setSyncedLlmId] = useState<string | undefined>(undefined);
  if (llm && llm.llm_id !== syncedLlmId) {
    setSyncedLlmId(llm.llm_id);
    setPrompt(llm.general_prompt || "");
    setBeginMessage(llm.begin_message || "");
  }

  const hasChanges = llm
    ? prompt !== (llm.general_prompt || "") || beginMessage !== (llm.begin_message || "")
    : false;

  const handleSavePrompt = useCallback(async () => {
    if (!llmId) return;
    try {
      await updateLlmMut.mutateAsync({
        general_prompt: prompt,
        begin_message: beginMessage,
      });
      toast("Prompt saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save prompt", "error");
    }
  }, [llmId, prompt, beginMessage, updateLlmMut, toast]);

  const handleUpdateAgent = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await updateAgentMut.mutateAsync({ agentId, data });
        queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
        toast("Settings saved", "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to save settings", "error");
      }
    },
    [agentId, updateAgentMut, queryClient, toast]
  );

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

  const voicemailEnabled = !!agent.voicemail_option;
  const voicemailActionType = agent.voicemail_option?.action?.type ?? "hangup";
  const ivrEnabled = !!agent.ivr_option;
  const callScreeningEnabled = !!agent.call_screening_option;
  const dtmfOptions = agent.user_dtmf_options ?? null;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6">
        <div className="max-w-[1800px] mx-auto flex items-center h-14 gap-3">
          <Link
            href={`/retell/${locationId}/agents`}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Back to agents"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>

          <h1 className="text-base font-semibold text-gray-900 truncate tracking-tight">
            {agent.agent_name || "Unnamed Agent"}
          </h1>

          <div className="flex items-center gap-2 ml-1">
            <Badge variant={agent.is_published ? "success" : "warning"} dot>
              {agent.is_published ? "Published" : "Draft"}
            </Badge>
            <span className="text-[11px] text-gray-400 font-medium">v{agent.version}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" icon={PhoneCall} onClick={() => setShowTestCall(true)}>
              Test Call
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={History}
              onClick={() => setShowVersions(true)}
            >
              <span className="hidden sm:inline">Versions & Publish</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Copy}
              onClick={copyId}
              className="hidden sm:inline-flex font-mono"
            >
              ID
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={handleDelete}>
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="bg-gray-50/80 border-b border-gray-200 px-4 lg:px-6">
        <div className="max-w-[1800px] mx-auto flex items-center h-[42px] gap-6 text-[12px] text-gray-500 overflow-x-auto">
          {llm ? (
            <InlineSelect
              icon={BrainCog}
              value={llm.model}
              options={LLM_MODEL_OPTIONS}
              searchable
              isSaving={updateLlmMut.isPending}
              onSave={(v) => handleUpdateLlm({ model: v })}
            />
          ) : (
            <span className="shrink-0">—</span>
          )}
          <span className="text-gray-300">|</span>
          <InlineSelect
            icon={Volume2}
            value={agent.voice_id}
            options={VOICE_OPTIONS}
            isSaving={updateAgentMut.isPending}
            onSave={(v) => handleUpdateAgent({ voice_id: v })}
          />
          <span className="text-gray-300">|</span>
          <InlineSelect
            icon={Globe}
            value={agent.language || "en-US"}
            options={LANGUAGE_OPTIONS}
            isSaving={updateAgentMut.isPending}
            onSave={(v) => handleUpdateAgent({ language: v })}
          />
          <span className="text-gray-300">|</span>
          <span className="shrink-0">Modified {timeAgo(agent.last_modification_timestamp)}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-[1800px] mx-auto h-full flex flex-col lg:flex-row">
          {/* Left: Prompt editor */}
          <div className="flex-1 flex flex-col border-r border-gray-200 min-w-0">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
              <span className="text-[13px] font-semibold text-gray-700">
                Agent Prompt
              </span>
              <button
                onClick={handleSavePrompt}
                disabled={!hasChanges || updateLlmMut.isPending}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                  hasChanges
                    ? "bg-brand-500 text-white hover:bg-brand-600"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                {updateLlmMut.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                Save
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter the agent's system prompt..."
                className="w-full h-full min-h-[300px] px-5 py-4 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none placeholder:text-gray-300"
              />
            </div>
            <div className="bg-white border-t border-gray-100 px-5 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-gray-600">
                  Welcome Message
                </span>
                <span className="text-[11px] text-gray-400">
                  {agent.response_engine?.type === "retell-llm"
                    ? "AI speaks first"
                    : ""}
                </span>
              </div>
              <Input
                type="text"
                value={beginMessage}
                onChange={(e) => setBeginMessage(e.target.value)}
                placeholder="Hi, how can I help you today?"
              />
            </div>
          </div>

          {/* Right: Settings panels */}
          <div className="w-full lg:w-[380px] shrink-0 overflow-y-auto bg-gray-50/50 relative">
            {(updateAgentMut.isPending || updateLlmMut.isPending) && (
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-[12px] font-medium shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving changes...
              </div>
            )}
            <SettingsPanel icon={Mic} title="Speech settings" defaultOpen>
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

            <SettingsPanel icon={Radio} title="Realtime transcription">
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

            <SettingsPanel icon={Phone} title="Call settings">
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

            <SettingsPanel icon={Zap} title="Functions">
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

            <SettingsPanel icon={BrainCircuit} title="Knowledge base & memory">
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
                  attachedIds={llm?.knowledge_base_ids ?? []}
                  isLoading={llmLoading}
                  isSaving={updateLlmMut.isPending}
                  onSave={(ids) => handleUpdateLlm({ knowledge_base_ids: ids })}
                />
              </div>
            </SettingsPanel>

            <SettingsPanel icon={Languages} title="Pronunciation">
              <PronunciationEditor
                entries={(agent.pronunciation_dictionary ?? []) as PronunciationEntry[]}
                isSaving={updateAgentMut.isPending}
                onSave={(entries) => handleUpdateAgent({ pronunciation_dictionary: entries })}
              />
            </SettingsPanel>

            <SettingsPanel icon={BarChart3} title="Post call extraction">
              <PostCallAnalysisEditor
                items={(agent.post_call_analysis_data ?? []) as PostCallAnalysisItem[]}
                isSaving={updateAgentMut.isPending}
                onSave={(items) => handleUpdateAgent({ post_call_analysis_data: items })}
              />
            </SettingsPanel>

            <SettingsPanel icon={Webhook} title="Webhook">
              <TextSetting
                label="Webhook URL"
                value={agent.webhook_url || ""}
                placeholder="https://your-server.com/webhook"
                onSave={(v) => handleUpdateAgent({ webhook_url: v || null })}
              />
              <TagListSetting
                label="Events"
                description="e.g. call_started, call_ended, call_analyzed"
                value={agent.webhook_events ?? []}
                placeholder="call_ended"
                onSave={(v) => handleUpdateAgent({ webhook_events: v })}
              />
            </SettingsPanel>

            <SettingsPanel icon={Database} title="Data & privacy">
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

            <SettingsPanel icon={Settings2} title="General">
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

            {/* Raw JSON collapsible */}
            <SettingsPanel icon={Settings2} title="Raw Config">
              <div className="p-3 overflow-auto max-h-[400px]">
                <pre className="text-[11px] text-gray-500 font-mono whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(agent, null, 2)}
                </pre>
              </div>
            </SettingsPanel>
          </div>
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

      {showVersions && (
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
