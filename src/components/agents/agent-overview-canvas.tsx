"use client";

import "@xyflow/react/dist/style.css";

import { useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import {
  Bot,
  BookOpen,
  Database,
  FileText,
  Hash,
  List,
  PhoneIncoming,
  Plus,
  ScanSearch,
  ToggleLeft,
  Type,
  Webhook,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InlineSelect } from "./inline-select";
import { ModelGlyph, modelIcon } from "./model-icons";
import { PostCallAnalysisEditor } from "./post-call-analysis-editor";
import { SessionToolsEditor, toolMeta } from "./session-tools-editor";
import { SliderSetting, TagListSetting, TextSetting, ToggleSetting } from "./field-controls";
import { LLM_MODEL_OPTIONS } from "@/lib/constants";
import type { PostCallAnalysisItem, RetellAgent, RetellLlm, SessionTool } from "@/types/retell";

type PanelKey = "agent" | "pre" | "post" | "extraction" | "memory" | "kb" | "webhook";

const PRESET_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  call_summary: { label: "Call Summary", icon: Type },
  call_successful: { label: "Call Successful", icon: ToggleLeft },
  user_sentiment: { label: "User Sentiment", icon: Type },
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  string: Type,
  enum: List,
  boolean: ToggleLeft,
  number: Hash,
};

function analysisRow(item: { type: string; name: string }) {
  if (item.type === "system-presets") {
    const p = PRESET_LABELS[item.name];
    return { label: p?.label ?? item.name, icon: p?.icon ?? Type };
  }
  return { label: item.name, icon: TYPE_ICONS[item.type] ?? Type };
}

// ---- Node renderers ---------------------------------------------------------

interface BlockData extends Record<string, unknown> {
  panel: PanelKey;
  selected: boolean;
  onSelect: (k: PanelKey) => void;
}

type BlockNode = Node<BlockData & Record<string, unknown>, "block" | "pill" | "label">;

function hiddenHandles() {
  const cls = "!w-1.5 !h-1.5 !bg-gray-300 !border-0 !min-w-0 !min-h-0";
  return (
    <>
      <Handle type="target" position={Position.Left} className={cls} />
      <Handle type="source" position={Position.Right} className={cls} />
      <Handle id="t" type="target" position={Position.Top} className={cls} />
      <Handle id="b" type="source" position={Position.Bottom} className={cls} />
      <Handle id="tb" type="target" position={Position.Bottom} className={cls} />
      <Handle id="st" type="source" position={Position.Top} className={cls} />
    </>
  );
}

function BlockCard({ data }: NodeProps<BlockNode>) {
  const d = data as BlockData & {
    title: string;
    tone: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
    rows?: { label: string; icon: React.ComponentType<{ className?: string }> }[];
    footer?: React.ReactNode;
    toggle?: { on: boolean; label: string; onToggle: () => void; busy: boolean };
  };
  const Icon = d.icon;
  return (
    <div
      onClick={() => d.onSelect(d.panel)}
      className={cn(
        "w-[260px] rounded-xl border bg-white shadow-sm cursor-pointer transition-all hover:shadow-md",
        d.selected ? "border-brand-500 ring-2 ring-brand-500/20" : "border-gray-200"
      )}
    >
      {hiddenHandles()}
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-t-xl border-b text-[12px] font-semibold", d.tone)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{d.title}</span>
      </div>
      <div className="p-3 space-y-2">
        {d.toggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              d.toggle?.onToggle();
            }}
            disabled={d.toggle.busy}
            className="flex items-center gap-2 text-[11px] font-medium text-gray-700 disabled:opacity-60"
          >
            <span
              className={cn(
                "relative w-8 h-[18px] rounded-full transition-colors",
                d.toggle.on ? "bg-brand-500" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all",
                  d.toggle.on ? "left-[16px]" : "left-[2px]"
                )}
              />
            </span>
            {d.toggle.label}
          </button>
        )}
        {d.description && <p className="text-[11px] leading-relaxed text-gray-500">{d.description}</p>}
        {d.rows && d.rows.length > 0 && (
          <ul className="space-y-1.5">
            {d.rows.slice(0, 6).map((r, i) => (
              <li
                key={`${r.label}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-700"
              >
                <r.icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{r.label}</span>
              </li>
            ))}
            {d.rows.length > 6 && (
              <li className="text-[11px] text-gray-400 pl-1">+{d.rows.length - 6} more</li>
            )}
          </ul>
        )}
        {d.footer !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600">
              <Plus className="w-3 h-3" />
              Add
            </span>
            {d.footer}
          </div>
        )}
      </div>
    </div>
  );
}

function PillNode({ data }: NodeProps<BlockNode>) {
  const d = data as BlockData & { title: string; tone: string; icon: React.ComponentType<{ className?: string }> };
  const Icon = d.icon;
  return (
    <div
      onClick={() => d.onSelect(d.panel)}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] font-semibold shadow-sm cursor-pointer transition-all hover:shadow-md",
        d.tone,
        d.selected && "ring-2 ring-brand-500/30 border-brand-500"
      )}
    >
      {hiddenHandles()}
      <Icon className="w-3.5 h-3.5" />
      {d.title}
    </div>
  );
}

function LabelNode({ data }: NodeProps<BlockNode>) {
  const d = data as unknown as { title: string; icon: React.ComponentType<{ className?: string }> };
  const Icon = d.icon;
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] text-gray-500">
      {hiddenHandles()}
      <Icon className="w-3.5 h-3.5" />
      {d.title}
    </div>
  );
}

const nodeTypes = { block: BlockCard, pill: PillNode, label: LabelNode };

// ---- Canvas + side panel ----------------------------------------------------

export interface AgentOverviewCanvasProps {
  agent: RetellAgent;
  llm?: RetellLlm;
  isSaving: boolean;
  onUpdateAgent: (data: Record<string, unknown>) => Promise<boolean>;
  /** Knowledge base picker, rendered inside the side panel. */
  kbPanel: React.ReactNode;
  kbCount: number;
  onEditPrompt: () => void;
}

export function AgentOverviewCanvas(props: AgentOverviewCanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}

function Inner({ agent, llm, isSaving, onUpdateAgent, kbPanel, kbCount, onEditPrompt }: AgentOverviewCanvasProps) {
  const [panel, setPanel] = useState<PanelKey | null>(null);

  const pre = (agent.pre_session_tools ?? []) as SessionTool[];
  const post = (agent.post_session_tools ?? []) as SessionTool[];
  const analysis = (agent.post_call_analysis_data ?? []) as unknown as (PostCallAnalysisItem & { type: string })[];
  const memory = agent.contact_memory_config;
  const webhookCount = agent.webhook_url ? 1 : 0;
  const analysisModel = agent.post_call_analysis_model ?? "gpt-4.1";

  const select = (k: PanelKey) => setPanel(k);
  const base = (k: PanelKey) => ({ panel: k, selected: panel === k, onSelect: select });

  const nodes: BlockNode[] = [
    { id: "dial", type: "label", position: { x: 0, y: 238 }, draggable: false, data: { ...base("agent"), title: "Dial in/out", icon: PhoneIncoming } as never },
    {
      id: "pre",
      type: "block",
      position: { x: 150, y: 160 },
      draggable: false,
      data: {
        ...base("pre"),
        title: "Pre-call functions",
        tone: "bg-pink-50 text-pink-800 border-pink-200",
        icon: Zap,
        description: pre.length ? undefined : "Look up data before the call starts, so your agent has context before it speaks.",
        rows: pre.map((t) => ({ label: t.name, icon: toolMeta(t.type).icon })),
        footer: null,
      } as never,
    },
    {
      id: "agent",
      type: "pill",
      position: { x: 560, y: 218 },
      draggable: false,
      data: { ...base("agent"), title: "Agent", tone: "bg-lime-50 text-lime-800 border-lime-200", icon: Bot } as never,
    },
    {
      id: "kb",
      type: "pill",
      position: { x: 505, y: 70 },
      draggable: false,
      data: {
        ...base("kb"),
        title: `Knowledge base & memory (${kbCount})`,
        tone: "bg-orange-50 text-orange-800 border-orange-200",
        icon: BookOpen,
      } as never,
    },
    {
      id: "webhook",
      type: "pill",
      position: { x: 545, y: 400 },
      draggable: false,
      data: {
        ...base("webhook"),
        title: `Webhook (${webhookCount})`,
        tone: "bg-violet-50 text-violet-800 border-violet-200",
        icon: Webhook,
      } as never,
    },
    {
      id: "memory",
      type: "block",
      position: { x: 900, y: 10 },
      draggable: false,
      data: {
        ...base("memory"),
        title: "Save conversation to memory",
        tone: "bg-indigo-50 text-indigo-800 border-indigo-200",
        icon: Database,
        description: "After each completed call, update contact's memory. $0.005 per run.",
        toggle: {
          on: !!memory?.enable_update,
          label: memory?.enable_update ? "Enabled" : "Disabled",
          busy: isSaving,
          onToggle: () =>
            void onUpdateAgent({
              contact_memory_config: { ...memory, enable_update: !memory?.enable_update },
            }),
        },
      } as never,
    },
    {
      id: "extraction",
      type: "block",
      position: { x: 900, y: 140 },
      draggable: false,
      data: {
        ...base("extraction"),
        title: "Post Call Extraction",
        tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
        icon: ScanSearch,
        rows: analysis.map(analysisRow),
        footer: (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <ModelGlyph model={analysisModel} className="w-3.5 h-3.5" />
            {analysisModel}
          </span>
        ),
      } as never,
    },
    {
      id: "postfn",
      type: "block",
      position: { x: 1260, y: 180 },
      draggable: false,
      data: {
        ...base("post"),
        title: "Post-call functions",
        tone: "bg-blue-50 text-blue-800 border-blue-200",
        icon: Zap,
        description: post.length ? undefined : "Update your systems after the call ends, like logging the outcome or creating follow-ups.",
        rows: post.map((t) => ({ label: t.name, icon: toolMeta(t.type).icon })),
        footer: null,
      } as never,
    },
  ];

  const edgeBase = { type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 } } as const;
  const solid = { stroke: "#94a3b8", strokeWidth: 1.5 };
  const dashed = { stroke: "#cbd5e1", strokeWidth: 1.5, strokeDasharray: "5 4" };
  const labelProps = {
    labelStyle: { fontSize: 12, fill: "#64748b" },
    labelBgStyle: { fill: "#f8fafc" },
    labelBgPadding: [6, 3] as [number, number],
  };
  const edges: Edge[] = [
    { id: "e1", source: "dial", target: "pre", style: solid, ...edgeBase },
    { id: "e2", source: "pre", target: "agent", label: "Call started", style: solid, ...labelProps, ...edgeBase },
    { id: "e3", source: "agent", target: "extraction", label: "Call ended", style: solid, ...labelProps, ...edgeBase },
    { id: "e4", source: "agent", target: "memory", style: solid, ...edgeBase },
    { id: "e5", source: "extraction", target: "postfn", style: solid, ...edgeBase },
    { id: "e6", source: "kb", sourceHandle: "b", target: "agent", targetHandle: "t", style: dashed, ...edgeBase },
    { id: "e7", source: "agent", sourceHandle: "b", target: "webhook", targetHandle: "t", style: dashed, ...edgeBase },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-330px)] min-h-[560px] rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="relative flex-1 min-h-[420px] bg-gray-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onPaneClick={() => setPanel(null)}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          minZoom={0.3}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#cbd5e1" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <aside className="lg:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white overflow-y-auto">
        {panel === null && (
          <div className="p-6 text-center">
            <Zap className="w-7 h-7 text-gray-300 mx-auto mb-2" />
            <p className="text-[13px] font-medium text-gray-700">Call workflow</p>
            <p className="text-[12px] text-gray-500 mt-1">
              Choose a block to edit what runs before the call, how it is analysed, and what happens
              after it ends.
            </p>
          </div>
        )}

        {panel === "agent" && (
          <div className="p-5 space-y-3">
            <h3 className="text-[14px] font-semibold text-gray-900">Agent</h3>
            <p className="text-[12px] text-gray-500">
              The conversation itself is shaped by the prompt, the model, the voice and the settings
              in the other tabs.
            </p>
            <dl className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-[12px]">
              <div className="flex justify-between px-3 py-2">
                <dt className="text-gray-500">Model</dt>
                <dd className="text-gray-800">{llm?.s2s_model ?? llm?.model ?? "Loading..."}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-gray-500">Version</dt>
                <dd className="text-gray-800">v{agent.version}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-gray-500">Prompt</dt>
                <dd className="text-gray-800">{llm ? `${llm.general_prompt?.length ?? 0} characters` : "Loading..."}</dd>
              </div>
            </dl>
            <Button size="sm" icon={FileText} onClick={onEditPrompt}>
              Edit prompt
            </Button>
          </div>
        )}

        {(panel === "pre" || panel === "post") && (
          <div className="p-5">
            <h3 className="text-[14px] font-semibold text-gray-900 mb-3">
              {panel === "pre" ? "Pre-call functions" : "Post-call functions"}
            </h3>
            <SessionToolsEditor
              key={panel}
              kind={panel}
              tools={panel === "pre" ? pre : post}
              isSaving={isSaving}
              onSave={(tools) =>
                onUpdateAgent(
                  panel === "pre" ? { pre_session_tools: tools } : { post_session_tools: tools }
                )
              }
            />
          </div>
        )}

        {panel === "extraction" && (
          <div>
            <div className="px-5 pt-5">
              <h3 className="text-[14px] font-semibold text-gray-900 mb-3">Post call extraction</h3>
              <p className="text-[12px] font-medium text-gray-700 mb-1">Model used for extraction</p>
              <InlineSelect
                value={analysisModel}
                options={LLM_MODEL_OPTIONS.map((o) => ({ ...o, icon: modelIcon(o.value) }))}
                searchable
                isSaving={isSaving}
                onSave={(v) => void onUpdateAgent({ post_call_analysis_model: v })}
              />
            </div>
            <PostCallAnalysisEditor
              items={analysis}
              isSaving={isSaving}
              onSave={(items) => void onUpdateAgent({ post_call_analysis_data: items })}
            />
          </div>
        )}

        {panel === "memory" && (
          <div className="py-3">
            <h3 className="px-5 pt-2 pb-1 text-[14px] font-semibold text-gray-900">Contact memory</h3>
            <ToggleSetting
              label="Read memory"
              description="Add saved memory about the caller to the agent prompt"
              value={memory?.enable_read ?? true}
              onSave={(v) => void onUpdateAgent({ contact_memory_config: { ...memory, enable_read: v } })}
            />
            <ToggleSetting
              label="Save conversation to memory"
              description="Rewrite the contact's memory after each call ($0.005 per run)"
              value={memory?.enable_update ?? false}
              onSave={(v) => void onUpdateAgent({ contact_memory_config: { ...memory, enable_update: v } })}
            />
          </div>
        )}

        {panel === "kb" && (
          <div className="py-3">
            <h3 className="px-5 pt-2 pb-1 text-[14px] font-semibold text-gray-900">Knowledge base & memory</h3>
            <ToggleSetting
              label="Read memory"
              description="Add saved memory about the caller to the agent prompt"
              value={memory?.enable_read ?? true}
              onSave={(v) => void onUpdateAgent({ contact_memory_config: { ...memory, enable_read: v } })}
            />
            <div className="border-t border-gray-100">{kbPanel}</div>
          </div>
        )}

        {panel === "webhook" && (
          <div className="py-3">
            <h3 className="px-5 pt-2 pb-1 text-[14px] font-semibold text-gray-900">Webhook</h3>
            <TextSetting
              label="Webhook URL"
              value={agent.webhook_url || ""}
              placeholder="https://your-server.com/webhook"
              onSave={(v) => void onUpdateAgent({ webhook_url: v || null })}
            />
            <TagListSetting
              label="Events"
              description="e.g. call_started, call_ended, call_analyzed"
              value={agent.webhook_events ?? []}
              placeholder="call_ended"
              onSave={(v) => void onUpdateAgent({ webhook_events: v })}
            />
            <SliderSetting
              label="Timeout (sec)"
              value={(agent.webhook_timeout_ms ?? 10000) / 1000}
              min={1}
              max={30}
              step={1}
              onSave={(v) => void onUpdateAgent({ webhook_timeout_ms: v * 1000 })}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
