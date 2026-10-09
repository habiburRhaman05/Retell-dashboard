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
  Panel,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type NodeChange,
  type Connection,
} from "@xyflow/react";
import {
  AlertCircle,
  Flag,
  GitBranch,
  Hash,
  LayoutGrid,
  MessageSquare,
  Plus,
  PhoneForwarded,
  Braces,
  PhoneOff,
  StickyNote,
  Trash2,
  Save,
  Undo2,
  Workflow as WorkflowIcon,
  Settings2,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InlineSelect } from "./inline-select";
import { modelIcon } from "./model-icons";
import { LLM_MODEL_OPTIONS } from "@/lib/constants";
import {
  PALETTE,
  addTransition,
  autoLayout,
  blockingReferences,
  createNodes,
  mapEdge,
  nodeMeta,
  nodeTitle,
  outgoingEdges,
  removeEdge,
  removeNode,
  supportsTransitionList,
  validateFlow,
  withPositions,
  type CreatableKind,
} from "@/lib/flow-utils";
import type {
  ConversationFlowData,
  FlowNodeData,
  FlowNoteData,
} from "@/hooks/use-agent-flow";

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  conversation: MessageSquare,
  branch: GitBranch,
  press_digit: Hash,
  transfer_call: PhoneForwarded,
  extract_dynamic_variables: Braces,
  end: PhoneOff,
};

// ---- React Flow node renderers (kept at module level so they stay stable) ----

type CardData = { node: FlowNodeData; isStart: boolean };
type CardNode = Node<CardData, "flowNode">;
type NoteData = { note: FlowNoteData; onChange: (content: string) => void };
type NoteNode = Node<NoteData, "noteNode">;

function FlowNodeCard({ data, selected }: NodeProps<CardNode>) {
  const { node, isStart } = data;
  const meta = nodeMeta(node.type);
  const Icon = KIND_ICONS[node.type] ?? Box;
  const edges = outgoingEdges(node);
  const text = node.instruction?.text;

  return (
    <div
      className={cn(
        "w-[300px] rounded-xl border bg-white shadow-sm transition-shadow",
        selected ? "border-brand-500 ring-2 ring-brand-500/20 shadow-md" : "border-gray-200"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white"
      />
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-t-xl border-b text-[12px] font-semibold", meta.tone)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate flex-1">{nodeTitle(node)}</span>
        {isStart && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
            <Flag className="w-2.5 h-2.5" />
            Start
          </span>
        )}
      </div>
      {text ? (
        <p className="px-3 py-2 text-[11px] leading-relaxed text-gray-600 line-clamp-4 whitespace-pre-wrap">
          {text}
        </p>
      ) : (
        <p className="px-3 py-2 text-[11px] text-gray-400 italic">{meta.label}</p>
      )}
      {edges.length > 0 && (
        <ul className="border-t border-gray-100 py-1">
          {edges.map((oe) => (
            <li
              key={oe.key}
              className="relative flex items-center gap-1.5 pl-3 pr-4 py-1.5 text-[11px] text-gray-600"
            >
              <span className="truncate" title={oe.label}>
                {oe.label}
              </span>
              <Handle
                id={oe.key}
                type="source"
                position={Position.Right}
                className="!w-2.5 !h-2.5 !bg-brand-500 !border-2 !border-white !-right-1.5"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteCard({ data, selected }: NodeProps<NoteNode>) {
  return (
    <div
      className={cn(
        "w-[220px] rounded-lg border bg-amber-50 shadow-sm p-2",
        selected ? "border-amber-400 ring-2 ring-amber-300/40" : "border-amber-200"
      )}
    >
      <textarea
        value={data.note.content}
        onChange={(e) => data.onChange(e.target.value)}
        placeholder="Write a note..."
        rows={4}
        className="nodrag w-full resize-none bg-transparent text-[12px] text-amber-900 placeholder:text-amber-400 focus:outline-none"
      />
    </div>
  );
}

const nodeTypes = { flowNode: FlowNodeCard, noteNode: NoteCard };

// ---- Editor ----------------------------------------------------------------

export interface WorkflowEditorProps {
  flow: ConversationFlowData;
  isSaving: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function buildPatch(s: {
  nodes: FlowNodeData[];
  notes: FlowNoteData[];
  startId: string | null;
  globalPrompt: string;
  startSpeaker: "agent" | "user";
  flexMode: boolean;
  model: string;
  modelChoice: ConversationFlowData["model_choice"];
}): Record<string, unknown> {
  return {
    nodes: s.nodes,
    notes: s.notes,
    start_node_id: s.startId,
    global_prompt: s.globalPrompt,
    start_speaker: s.startSpeaker,
    flex_mode: s.flexMode,
    model_choice: s.modelChoice ? { ...s.modelChoice, model: s.model } : undefined,
  };
}

function initialState(flow: ConversationFlowData) {
  const startId = flow.start_node_id ?? flow.nodes[0]?.id ?? null;
  return {
    nodes: withPositions(flow.nodes ?? [], startId),
    notes: flow.notes ?? [],
    startId,
    globalPrompt: flow.global_prompt ?? "",
    startSpeaker: (flow.start_speaker ?? "agent") as "agent" | "user",
    flexMode: !!flow.flex_mode,
    model: flow.model_choice?.model ?? "gpt-4.1",
    modelChoice: flow.model_choice,
  };
}

function WorkflowEditorInner({ flow, isSaving, onSave }: WorkflowEditorProps) {
  const init = initialState(flow);
  const [nodes, setNodes] = useState<FlowNodeData[]>(init.nodes);
  const [notes, setNotes] = useState<FlowNoteData[]>(init.notes);
  const [startId, setStartId] = useState<string | null>(init.startId);
  const [globalPrompt, setGlobalPrompt] = useState(init.globalPrompt);
  const [startSpeaker, setStartSpeaker] = useState<"agent" | "user">(init.startSpeaker);
  const [flexMode, setFlexMode] = useState(init.flexMode);
  const [model, setModel] = useState(init.model);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"global" | "node">("global");
  const [problems, setProblems] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(() => JSON.stringify(buildPatch(init)));
  const [syncedKey, setSyncedKey] = useState(
    `${flow.conversation_flow_id}:${flow.version}:${flow.last_modification_timestamp}`
  );
  const rf = useReactFlow();

  const current = buildPatch({
    nodes,
    notes,
    startId,
    globalPrompt,
    startSpeaker,
    flexMode,
    model,
    modelChoice: flow.model_choice,
  });
  const dirty = JSON.stringify(current) !== baseline;

  // Adopt a newer version from Retell, but never overwrite unsaved edits.
  const flowKey = `${flow.conversation_flow_id}:${flow.version}:${flow.last_modification_timestamp}`;
  if (flowKey !== syncedKey && !dirty) {
    const next = initialState(flow);
    setSyncedKey(flowKey);
    setNodes(next.nodes);
    setNotes(next.notes);
    setStartId(next.startId);
    setGlobalPrompt(next.globalPrompt);
    setStartSpeaker(next.startSpeaker);
    setFlexMode(next.flexMode);
    setModel(next.model);
    setBaseline(JSON.stringify(buildPatch(next)));
  }

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const updateNode = (id: string, fn: (n: FlowNodeData) => FlowNodeData) =>
    setNodes((prev) => prev.map((n) => (n.id === id ? fn(n) : n)));

  // ---- React Flow wiring
  const rfNodes: (CardNode | NoteNode)[] = [
    ...nodes.map(
      (n): CardNode => ({
        id: n.id,
        type: "flowNode",
        position: n.display_position ?? { x: 0, y: 0 },
        selected: n.id === selectedId,
        data: { node: n, isStart: n.id === startId },
      })
    ),
    ...notes.map(
      (note): NoteNode => ({
        id: `note:${note.id}`,
        type: "noteNode",
        position: note.display_position,
        data: {
          note,
          onChange: (content: string) =>
            setNotes((prev) => prev.map((x) => (x.id === note.id ? { ...x, content } : x))),
        },
      })
    ),
  ];

  const nodeIds = new Set(nodes.map((n) => n.id));
  const rfEdges: Edge[] = nodes.flatMap((n) =>
    outgoingEdges(n)
      .filter((oe) => nodeIds.has(oe.edge.destination_node_id))
      .map(
        (oe): Edge => ({
          id: `${n.id}::${oe.key}`,
          source: n.id,
          sourceHandle: oe.key,
          target: oe.edge.destination_node_id,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        })
      )
  );

  const onNodesChange = (changes: NodeChange<CardNode | NoteNode>[]) => {
    for (const c of changes) {
      if (c.type === "position" && c.position) {
        const pos = c.position;
        if (c.id.startsWith("note:")) {
          const id = c.id.slice(5);
          setNotes((prev) => prev.map((x) => (x.id === id ? { ...x, display_position: pos } : x)));
        } else {
          updateNode(c.id, (n) => ({ ...n, display_position: pos }));
        }
      } else if (c.type === "select" && c.selected && !c.id.startsWith("note:")) {
        setSelectedId(c.id);
        setPanelTab("node");
      }
    }
  };

  const onConnect = (conn: Connection) => {
    if (!conn.source || !conn.target || !conn.sourceHandle) return;
    if (conn.source.startsWith("note:") || conn.target.startsWith("note:")) return;
    const key = conn.sourceHandle;
    const target = conn.target;
    updateNode(conn.source, (n) => mapEdge(n, key, (e) => ({ ...e, destination_node_id: target })));
  };

  // New nodes go just right of the rightmost node, so they never land on top
  // of existing ones.
  const centerPosition = () => {
    const xs = nodes.map((n) => n.display_position?.x ?? 0);
    const ys = nodes.map((n) => n.display_position?.y ?? 0);
    if (xs.length === 0) return { x: 120, y: 120 };
    return {
      x: Math.round(Math.max(...xs) + 440),
      y: Math.round(ys.reduce((a, b) => a + b, 0) / ys.length),
    };
  };
  const fitSoon = () => setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 60);

  const addNode = (kind: CreatableKind) => {
    const added = createNodes(kind, nodes, centerPosition());
    setNodes((prev) => [...prev, ...added]);
    setSelectedId(added[0].id);
    setPanelTab("node");
    if (!startId) setStartId(added[0].id);
    fitSoon();
  };

  const addNote = () => {
    const id = `note-${Math.random().toString(36).slice(2, 8)}`;
    setNotes((prev) => [
      ...prev,
      { id, content: "", display_position: centerPosition(), size: { width: 220, height: 110 } },
    ]);
    fitSoon();
  };

  const deleteSelected = () => {
    if (!selectedNode) return;
    const blockers = blockingReferences(nodes, selectedNode.id);
    if (blockers.length > 0) {
      setProblems([
        `Cannot delete "${nodeTitle(selectedNode)}" yet. These nodes still route to it: ${blockers
          .map(nodeTitle)
          .join(", ")}. Point their transitions somewhere else first.`,
      ]);
      return;
    }
    if (startId === selectedNode.id) {
      const next = nodes.find((n) => n.id !== selectedNode.id);
      setStartId(next?.id ?? null);
    }
    setNodes((prev) => removeNode(prev, selectedNode.id));
    setSelectedId(null);
    setPanelTab("global");
    setProblems([]);
  };

  const discard = () => {
    const next = initialState(flow);
    setNodes(next.nodes);
    setNotes(next.notes);
    setStartId(next.startId);
    setGlobalPrompt(next.globalPrompt);
    setStartSpeaker(next.startSpeaker);
    setFlexMode(next.flexMode);
    setModel(next.model);
    setBaseline(JSON.stringify(buildPatch(next)));
    setSelectedId(null);
    setProblems([]);
    setSaveError(null);
  };

  const save = async () => {
    const found = validateFlow(nodes, startId);
    setProblems(found);
    setSaveError(null);
    if (found.length > 0) {
      setPanelTab("global");
      return;
    }
    try {
      await onSave(current);
      setBaseline(JSON.stringify(current));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save the workflow");
    }
  };

  const modelOptions = LLM_MODEL_OPTIONS.map((o) => ({ ...o, icon: modelIcon(o.value) }));
  if (!modelOptions.some((o) => o.value === model)) {
    modelOptions.unshift({ value: model, label: model, group: "Current", icon: modelIcon(model) } as never);
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-330px)] min-h-[560px] rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="relative flex-1 min-h-[420px] bg-gray-50">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onPaneClick={() => {
            setSelectedId(null);
            setPanelTab("global");
          }}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#cbd5e1" />
          <Controls showInteractive={false} />
          <Panel position="bottom-center">
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white shadow-md p-1.5">
              {PALETTE.map((kind) => {
                const Icon = KIND_ICONS[kind] ?? Box;
                const meta = nodeMeta(kind);
                return (
                  <button
                    key={kind}
                    onClick={() => addNode(kind)}
                    title={`Add ${meta.label}`}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className={cn("w-6 h-6 rounded-md border flex items-center justify-center", meta.tone)}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="hidden xl:inline">{meta.label}</span>
                  </button>
                );
              })}
              <button
                onClick={addNote}
                title="Add Note"
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="w-6 h-6 rounded-md border bg-amber-50 text-amber-700 border-amber-200 flex items-center justify-center">
                  <StickyNote className="w-3.5 h-3.5" />
                </span>
                <span className="hidden xl:inline">Note</span>
              </button>
            </div>
          </Panel>

          <Panel position="top-right">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white shadow-sm p-1.5">
              <Button
                size="sm"
                variant="ghost"
                icon={LayoutGrid}
                onClick={() => {
                  setNodes((prev) => autoLayout(prev, startId));
                  setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 50);
                }}
              >
                Auto layout
              </Button>
              {dirty && (
                <Button size="sm" variant="ghost" icon={Undo2} onClick={discard} disabled={isSaving}>
                  Discard
                </Button>
              )}
              <Button
                size="sm"
                icon={Save}
                loading={isSaving}
                disabled={!dirty || isSaving}
                onClick={save}
              >
                {dirty ? "Save workflow" : "Saved"}
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right panel */}
      <aside className="lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col min-h-0">
        <div className="p-3 border-b border-gray-100">
          <div className="grid grid-cols-2 p-1 rounded-lg bg-gray-100">
            {(
              [
                { key: "global", label: "Global settings" },
                { key: "node", label: "Node settings" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setPanelTab(t.key)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium rounded-md transition-all",
                  panelTab === t.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(problems.length > 0 || saveError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-red-700">
                <AlertCircle className="w-3.5 h-3.5" />
                {saveError ? "Retell rejected the workflow" : "Fix these before saving"}
              </p>
              {saveError && <p className="text-[12px] text-red-600 break-words">{saveError}</p>}
              <ul className="list-disc pl-4 text-[12px] text-red-600 space-y-0.5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {panelTab === "global" ? (
            <GlobalPanel
              globalPrompt={globalPrompt}
              onGlobalPrompt={setGlobalPrompt}
              startSpeaker={startSpeaker}
              onStartSpeaker={setStartSpeaker}
              flexMode={flexMode}
              onFlexMode={setFlexMode}
              model={model}
              onModel={setModel}
              modelOptions={modelOptions}
              modelEditable={!flow.model_choice || flow.model_choice.type === "cascading"}
              nodes={nodes}
              startId={startId}
              onStartId={setStartId}
            />
          ) : selectedNode ? (
            <NodePanel
              key={selectedNode.id}
              node={selectedNode}
              nodes={nodes}
              isStart={selectedNode.id === startId}
              onChange={(fn) => updateNode(selectedNode.id, fn)}
              onSetStart={() => setStartId(selectedNode.id)}
              onDelete={deleteSelected}
              onAddTransition={(dest) =>
                updateNode(selectedNode.id, (n) => addTransition(n, nodes, dest))
              }
              onReplace={(next) => updateNode(selectedNode.id, () => next)}
            />
          ) : (
            <div className="py-10 text-center">
              <WorkflowIcon className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-[13px] text-gray-600">Select a node to edit it</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Drag from a transition dot to another node to connect them.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---- Panels ----------------------------------------------------------------

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-gray-700 mb-1">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 -mt-0.5 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const selectClass =
  "w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400";

function GlobalPanel(props: {
  globalPrompt: string;
  onGlobalPrompt: (v: string) => void;
  startSpeaker: "agent" | "user";
  onStartSpeaker: (v: "agent" | "user") => void;
  flexMode: boolean;
  onFlexMode: (v: boolean) => void;
  model: string;
  onModel: (v: string) => void;
  modelOptions: { value: string; label: string; group?: string; icon: React.ComponentType<{ className?: string }> }[];
  modelEditable: boolean;
  nodes: FlowNodeData[];
  startId: string | null;
  onStartId: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-brand-500" />
        <h3 className="text-[13px] font-semibold text-gray-900">Agent settings</h3>
      </div>

      <Field label="Model">
        {props.modelEditable ? (
          <InlineSelect
            value={props.model}
            options={props.modelOptions}
            searchable
            onSave={props.onModel}
          />
        ) : (
          <p className="text-[12px] text-gray-500 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            This workflow uses a speech-to-speech model. Change it in Retell.
          </p>
        )}
      </Field>

      <Field label="Who speaks first">
        <select
          className={selectClass}
          value={props.startSpeaker}
          onChange={(e) => props.onStartSpeaker(e.target.value as "agent" | "user")}
        >
          <option value="agent">AI speaks first</option>
          <option value="user">User speaks first</option>
        </select>
      </Field>

      <Field label="Start node" hint="The first node the conversation enters">
        <select
          className={selectClass}
          value={props.startId ?? ""}
          onChange={(e) => props.onStartId(e.target.value)}
        >
          {props.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {nodeTitle(n)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Global prompt" hint="Applies to every node in the workflow">
        <Textarea
          rows={8}
          value={props.globalPrompt}
          onChange={(e) => props.onGlobalPrompt(e.target.value)}
          placeholder="You are a helpful assistant for..."
        />
      </Field>

      <Field label="Transition flexibility">
        <div className="space-y-2">
          {(
            [
              { v: true, title: "Flex mode", desc: "The agent may move between nodes more freely." },
              { v: false, title: "Rigid mode", desc: "The agent follows the transitions exactly." },
            ] as const
          ).map((o) => (
            <button
              key={o.title}
              onClick={() => props.onFlexMode(o.v)}
              aria-pressed={props.flexMode === o.v}
              className={cn(
                "w-full text-left rounded-lg border px-3 py-2 transition-all",
                props.flexMode === o.v
                  ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500/20"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <p className="text-[13px] font-medium text-gray-900">{o.title}</p>
              <p className="text-[11px] text-gray-500">{o.desc}</p>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function NodePanel({
  node,
  nodes,
  isStart,
  onChange,
  onSetStart,
  onDelete,
  onAddTransition,
  onReplace,
}: {
  node: FlowNodeData;
  nodes: FlowNodeData[];
  isStart: boolean;
  onChange: (fn: (n: FlowNodeData) => FlowNodeData) => void;
  onSetStart: () => void;
  onDelete: () => void;
  onAddTransition: (dest: string) => void;
  onReplace: (next: FlowNodeData) => void;
}) {
  const meta = nodeMeta(node.type);
  const edges = outgoingEdges(node);
  const hasInstruction = node.instruction !== undefined || ["conversation", "end", "press_digit", "subagent"].includes(node.type);
  const others = nodes.filter((n) => n.id !== node.id);
  const dest = node.transfer_destination as { type?: string; number?: string; prompt?: string } | undefined;
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={cn("px-2 py-0.5 rounded-md border text-[11px] font-semibold", meta.tone)}>
          {meta.label}
        </span>
        {isStart ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <Flag className="w-3 h-3" /> Start node
          </span>
        ) : (
          <button onClick={onSetStart} className="text-[11px] text-brand-600 hover:underline">
            Set as start
          </button>
        )}
        <Button size="sm" variant="danger" icon={Trash2} className="ml-auto" onClick={onDelete}>
          Delete
        </Button>
      </div>

      <Field label="Name">
        <Input
          value={node.name ?? ""}
          placeholder={meta.label}
          onChange={(e) => {
            const value = e.target.value;
            onChange((n) => ({ ...n, name: value }));
          }}
        />
      </Field>

      {hasInstruction && (
        <Field
          label={node.type === "end" ? "Closing line (optional)" : "Instruction"}
          hint={
            node.instruction?.type && node.instruction.type !== "prompt"
              ? `Type: ${node.instruction.type.replace(/_/g, " ")}`
              : undefined
          }
        >
          <Textarea
            rows={6}
            value={node.instruction?.text ?? ""}
            placeholder="What should the agent do or say at this step?"
            onChange={(e) => {
              // Read the value now: React resets the DOM value before updaters run.
              const value = e.target.value;
              onChange((n) => ({
                ...n,
                instruction: { type: n.instruction?.type ?? "prompt", ...n.instruction, text: value },
              }));
            }}
          />
        </Field>
      )}

      {node.type === "transfer_call" && (
        <Field label="Transfer to" hint="Phone number in E.164 format, e.g. +14155550123">
          <Input
            value={dest?.number ?? ""}
            placeholder="+14155550123"
            onChange={(e) => {
              const value = e.target.value;
              onChange((n) => ({
                ...n,
                transfer_destination: { ...(dest ?? { type: "predefined" }), type: "predefined", number: value },
              }));
            }}
          />
        </Field>
      )}

      {(supportsTransitionList(node.type) || edges.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-gray-900">Transitions</p>
            {supportsTransitionList(node.type) && others.length > 0 && (
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => onAddTransition(others[0].id)}>
                Add
              </Button>
            )}
          </div>
          {edges.length === 0 && (
            <p className="text-[12px] text-gray-400">
              No transitions yet. Add one, or drag from a node dot on the canvas.
            </p>
          )}
          {edges.map((oe) => {
            const promptCond = oe.edge.transition_condition;
            const editable = oe.field === "edges" && promptCond?.type === "prompt";
            return (
              <div key={oe.key} className="rounded-lg border border-gray-200 p-2.5 space-y-2 bg-gray-50/50">
                <div className="flex items-start gap-2">
                  {editable ? (
                    <Textarea
                      rows={2}
                      value={promptCond.prompt ?? ""}
                      placeholder="When should this transition happen?"
                      onChange={(e) => {
                        const value = e.target.value;
                        onChange((n) =>
                          mapEdge(n, oe.key, (x) => ({
                            ...x,
                            transition_condition: { ...x.transition_condition, prompt: value },
                          }))
                        );
                      }}
                    />
                  ) : (
                    <p className="flex-1 text-[12px] font-medium text-gray-700 pt-1">{oe.label}</p>
                  )}
                  {oe.removable && (
                    <button
                      onClick={() => onChange((n) => removeEdge(n, oe.key))}
                      aria-label="Remove transition"
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">Go to</p>
                  <select
                    className={selectClass}
                    value={oe.edge.destination_node_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      onChange((n) =>
                        mapEdge(n, oe.key, (x) => ({ ...x, destination_node_id: value }))
                      );
                    }}
                  >
                    {!nodes.some((n) => n.id === oe.edge.destination_node_id) && (
                      <option value={oe.edge.destination_node_id}>Choose a node...</option>
                    )}
                    {others.concat(node).map((n) => (
                      <option key={n.id} value={n.id}>
                        {nodeTitle(n)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowJson((v) => !v)}
          className="text-[12px] font-medium text-gray-600 hover:text-gray-900"
        >
          {showJson ? "Hide" : "Show"} advanced settings (JSON)
        </button>
        {showJson && (
          <RawJson key={JSON.stringify(node)} node={node} onApply={onReplace} />
        )}
      </div>
    </div>
  );
}

function RawJson({ node, onApply }: { node: FlowNodeData; onApply: (n: FlowNodeData) => void }) {
  const [text, setText] = useState(() => JSON.stringify(node, null, 2));
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    try {
      const parsed = JSON.parse(text) as FlowNodeData;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Expected a JSON object");
      }
      if (parsed.id !== node.id) throw new Error("The node id cannot be changed");
      if (typeof parsed.type !== "string") throw new Error("The node needs a type");
      setError(null);
      onApply(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <p className="text-[11px] text-gray-400">
        Use this for options that have no field above, such as functions, SMS, code and MCP nodes.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        spellCheck={false}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
      />
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <Button size="sm" variant="secondary" onClick={apply}>
        Apply JSON
      </Button>
    </div>
  );
}
