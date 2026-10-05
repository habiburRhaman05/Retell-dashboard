"use client";

import { useParams, useRouter } from "next/navigation";
import { useLocation } from "@/providers/location-provider";
import { useAgentDetail } from "@/hooks/use-agent-detail";
import { useDeleteAgent, useUpdateAgent } from "@/hooks/use-agents";
import { useToast } from "@/components/layout/toast";
import { cn, timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Trash2,
  Copy,
  Save,
  ChevronDown,
  Volume2,
  Phone,
  BarChart3,
  BrainCircuit,
  Mic,
  Settings2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RetellLlm } from "@/types/retell";

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
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
  const { data: llm } = useQuery<RetellLlm>({
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
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (llm) {
      setPrompt(llm.general_prompt || "");
      setBeginMessage(llm.begin_message || "");
    }
  }, [llm]);

  useEffect(() => {
    if (!llm) return;
    const promptChanged = prompt !== (llm.general_prompt || "");
    const msgChanged = beginMessage !== (llm.begin_message || "");
    setHasChanges(promptChanged || msgChanged);
  }, [prompt, beginMessage, llm]);

  const handleSavePrompt = useCallback(async () => {
    if (!llmId) return;
    try {
      await updateLlmMut.mutateAsync({
        general_prompt: prompt,
        begin_message: beginMessage,
      });
      setHasChanges(false);
      toast("Prompt saved", "success");
    } catch {
      toast("Failed to save prompt", "error");
    }
  }, [llmId, prompt, beginMessage, updateLlmMut, toast]);

  const handleUpdateAgent = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await updateAgentMut.mutateAsync({ agentId, data });
        queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
        toast("Settings saved", "success");
      } catch {
        toast("Failed to save settings", "error");
      }
    },
    [agentId, updateAgentMut, queryClient, toast]
  );

  const handleDelete = async () => {
    if (!confirm(`Delete "${agent?.agent_name || "Unnamed"}"? This cannot be undone.`))
      return;
    try {
      await deleteAgentMut.mutateAsync(agentId);
      toast("Agent deleted", "success");
      router.push(`/retell/${locationId}/agents`);
    } catch {
      toast("Failed to delete agent", "error");
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(agentId);
    toast("Agent ID copied", "info");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
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
          className="text-cyan-500 text-sm mt-3 inline-block hover:underline"
        >
          Back to Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6">
        <div className="max-w-[1400px] mx-auto flex items-center h-[52px] gap-4">
          <Link
            href={`/retell/${locationId}/agents`}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>

          <h1 className="text-[15px] font-semibold text-gray-900 truncate">
            {agent.agent_name || "Unnamed Agent"}
          </h1>

          <div className="flex items-center gap-2 ml-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                agent.is_published
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-amber-50 text-amber-600"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  agent.is_published ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
              {agent.is_published ? "Published" : "Draft"}
            </span>
            <span className="text-[11px] text-gray-400">V{agent.version}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={copyId}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Copy className="w-3 h-3" /> ID
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 lg:px-6">
        <div className="max-w-[1400px] mx-auto flex items-center h-[40px] gap-6 text-[12px] text-gray-500 overflow-x-auto">
          <span className="shrink-0">{llm?.model || "—"}</span>
          <span className="text-gray-300">|</span>
          <span className="shrink-0 inline-flex items-center gap-1">
            <Volume2 className="w-3 h-3" />
            {agent.voice_id?.replace(/^(retell|cartesia|minimax|11labs|fish_audio|openai|inworld)-/, "")}
          </span>
          <span className="text-gray-300">|</span>
          <span className="shrink-0">{agent.language || "en-US"}</span>
          <span className="text-gray-300">|</span>
          <span className="shrink-0">Modified {timeAgo(agent.last_modification_timestamp)}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-[1400px] mx-auto h-full flex flex-col lg:flex-row">
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
                    ? "bg-cyan-500 text-white hover:bg-cyan-600"
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
              <input
                type="text"
                value={beginMessage}
                onChange={(e) => setBeginMessage(e.target.value)}
                placeholder="Hi, how can I help you today?"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          {/* Right: Settings panels */}
          <div className="w-full lg:w-[380px] shrink-0 overflow-y-auto bg-gray-50/50">
            <SettingsPanel
              icon={Mic}
              title="Speech settings"
              defaultOpen
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
                label="Backchannel"
                description="Agent says 'uh-huh', 'yeah' etc."
                value={agent.enable_backchannel ?? false}
                onSave={(v) => handleUpdateAgent({ enable_backchannel: v })}
              />
            </SettingsPanel>

            <SettingsPanel icon={Phone} title="Call settings">
              <SliderSetting
                label="Max Call Duration (min)"
                value={(agent.max_call_duration_ms ?? 3600000) / 60000}
                min={1}
                max={120}
                step={1}
                onSave={(v) =>
                  handleUpdateAgent({ max_call_duration_ms: v * 60000 })
                }
              />
              <SliderSetting
                label="End After Silence (sec)"
                value={(agent.end_call_after_silence_ms ?? 600000) / 1000}
                min={10}
                max={600}
                step={10}
                onSave={(v) =>
                  handleUpdateAgent({ end_call_after_silence_ms: v * 1000 })
                }
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
                onSave={(v) =>
                  handleUpdateAgent({ ambient_sound: v || null })
                }
              />
              <ToggleSetting
                label="Allow User DTMF"
                description="Let caller press phone keys"
                value={agent.allow_user_dtmf ?? true}
                onSave={(v) => handleUpdateAgent({ allow_user_dtmf: v })}
              />
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
              {llm?.knowledge_base_ids && llm.knowledge_base_ids.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100">
                  <p className="text-[12px] text-gray-500 mb-1">
                    Knowledge Bases
                  </p>
                  {llm.knowledge_base_ids.map((id) => (
                    <div
                      key={id}
                      className="text-[11px] font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded mt-1"
                    >
                      {id}
                    </div>
                  ))}
                </div>
              )}
            </SettingsPanel>

            <SettingsPanel icon={BarChart3} title="Post call extraction">
              <div className="px-4 py-3">
                {agent.post_call_analysis_data &&
                agent.post_call_analysis_data.length > 0 ? (
                  <div className="space-y-2">
                    {agent.post_call_analysis_data.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-[12px] text-gray-600 bg-gray-50 px-3 py-2 rounded-lg"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium text-gray-700">
                            {(item as Record<string, string>).name || `Item ${i + 1}`}
                          </p>
                          {(item as Record<string, string>).description && (
                            <p className="text-gray-400 mt-0.5">
                              {(item as Record<string, string>).description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-gray-400 text-center py-4">
                    No post-call analysis configured
                  </p>
                )}
              </div>
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
                <div>
                  <p className="text-[12px] text-gray-500 mb-1">
                    Data Storage
                  </p>
                  <p className="text-[12px] text-gray-700 capitalize">
                    {(agent as Record<string, unknown>).data_storage_setting as string || "everything"}
                  </p>
                </div>
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
    </div>
  );
}

function SettingsPanel({
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

function SliderSetting({
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

  useEffect(() => {
    setLocal(value);
    setDirty(false);
  }, [value]);

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
              className="text-[10px] font-medium text-cyan-600 hover:text-cyan-700"
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
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 accent-cyan-500"
      />
    </div>
  );
}

function ToggleSetting({
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
          value ? "bg-cyan-500" : "bg-gray-300"
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

function SelectSetting({
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
        className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 text-[12px] text-gray-700 bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
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
