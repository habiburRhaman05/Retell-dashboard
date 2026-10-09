import type { FlowEdgeData, FlowNodeData } from "@/hooks/use-agent-flow";

/** Edge fields that hold a single transition. `edges` is the repeatable list. */
export const SINGLE_EDGE_FIELDS = [
  "else_edge",
  "skip_response_edge",
  "always_edge",
  "edge",
  "success_edge",
  "failed_edge",
] as const;
export type SingleEdgeField = (typeof SINGLE_EDGE_FIELDS)[number];

export interface OutEdge {
  /** Unique per node. Also used as the React Flow handle id. */
  key: string;
  field: "edges" | SingleEdgeField;
  edge: FlowEdgeData;
  /** Only entries of the `edges` list can be removed. */
  removable: boolean;
  label: string;
}

const SINGLE_LABELS: Record<SingleEdgeField, string> = {
  else_edge: "Else",
  skip_response_edge: "Skip response",
  always_edge: "Always",
  edge: "Next",
  success_edge: "Sent successfully",
  failed_edge: "Failed",
};

export function conditionLabel(edge: FlowEdgeData): string {
  const c = edge.transition_condition;
  if (!c) return "Transition";
  if (c.type === "prompt") return c.prompt || "Transition";
  if (c.type === "equation") return "Equation condition";
  return "Transition";
}

export function outgoingEdges(node: FlowNodeData): OutEdge[] {
  const out: OutEdge[] = [];
  (node.edges ?? []).forEach((edge, i) => {
    out.push({
      key: `edges:${edge.id ?? i}`,
      field: "edges",
      edge,
      removable: true,
      label: conditionLabel(edge),
    });
  });
  for (const field of SINGLE_EDGE_FIELDS) {
    const edge = node[field] as FlowEdgeData | undefined;
    if (edge && typeof edge === "object") {
      out.push({
        key: field,
        field,
        edge,
        removable: false,
        label: edge.transition_condition?.prompt || SINGLE_LABELS[field],
      });
    }
  }
  return out;
}

export interface NodeMeta {
  label: string;
  /** header/badge colours */
  tone: string;
  /** palette can create this type */
  creatable: boolean;
}

export const NODE_META: Record<string, NodeMeta> = {
  conversation: { label: "Conversation", tone: "bg-pink-50 text-pink-700 border-pink-200", creatable: true },
  subagent: { label: "Subagent", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", creatable: false },
  function: { label: "Function", tone: "bg-violet-50 text-violet-700 border-violet-200", creatable: false },
  transfer_call: { label: "Call Transfer", tone: "bg-amber-50 text-amber-700 border-amber-200", creatable: true },
  press_digit: { label: "Press Digit", tone: "bg-sky-50 text-sky-700 border-sky-200", creatable: true },
  branch: { label: "Logic Split", tone: "bg-indigo-50 text-indigo-700 border-indigo-200", creatable: true },
  agent_swap: { label: "Agent Transfer", tone: "bg-orange-50 text-orange-700 border-orange-200", creatable: false },
  sms: { label: "In-Call SMS", tone: "bg-yellow-50 text-yellow-700 border-yellow-200", creatable: false },
  extract_dynamic_variables: { label: "Extract Variable", tone: "bg-slate-50 text-slate-700 border-slate-200", creatable: true },
  code: { label: "Code", tone: "bg-gray-50 text-gray-700 border-gray-200", creatable: false },
  mcp: { label: "MCP", tone: "bg-blue-50 text-blue-700 border-blue-200", creatable: false },
  end: { label: "Ending", tone: "bg-teal-50 text-teal-700 border-teal-200", creatable: true },
  component: { label: "Subflow", tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", creatable: false },
  bridge_transfer: { label: "Bridge transfer", tone: "bg-amber-50 text-amber-700 border-amber-200", creatable: false },
  cancel_transfer: { label: "Cancel transfer", tone: "bg-amber-50 text-amber-700 border-amber-200", creatable: false },
};

export function nodeMeta(type: string): NodeMeta {
  return (
    NODE_META[type] ?? {
      label: type.replace(/_/g, " "),
      tone: "bg-gray-50 text-gray-700 border-gray-200",
      creatable: false,
    }
  );
}

export function nodeTitle(node: FlowNodeData): string {
  return node.name?.trim() || nodeMeta(node.type).label;
}

export function randomId(prefix: string, taken: Set<string>): string {
  for (let i = 0; i < 20; i++) {
    const id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.has(id)) return id;
  }
  return `${prefix}-${Date.now()}`;
}

export function allIds(nodes: FlowNodeData[]): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    ids.add(n.id);
    for (const e of outgoingEdges(n)) ids.add(e.edge.id);
  }
  return ids;
}

export type CreatableKind =
  | "conversation"
  | "end"
  | "branch"
  | "press_digit"
  | "transfer_call"
  | "extract_dynamic_variables";

export const PALETTE: CreatableKind[] = [
  "conversation",
  "branch",
  "press_digit",
  "transfer_call",
  "extract_dynamic_variables",
  "end",
];

function edgeOf(
  taken: Set<string>,
  prompt: string,
  dest: string
): FlowEdgeData {
  const id = randomId("edge", taken);
  taken.add(id);
  return { id, transition_condition: { type: "prompt", prompt }, destination_node_id: dest };
}

/**
 * Builds the node (and, when a required transition needs somewhere to go, an
 * Ending node) for a palette entry. Returns every node that must be added.
 */
export function createNodes(
  kind: CreatableKind,
  existing: FlowNodeData[],
  position: { x: number; y: number }
): FlowNodeData[] {
  const taken = allIds(existing);
  const id = randomId(kind === "extract_dynamic_variables" ? "extract" : kind, taken);
  taken.add(id);
  const added: FlowNodeData[] = [];

  const needsFallback = kind === "branch" || kind === "transfer_call";
  let fallbackId = existing.find((n) => n.type === "end")?.id;
  if (needsFallback && !fallbackId) {
    fallbackId = randomId("end", taken);
    taken.add(fallbackId);
    added.push({
      id: fallbackId,
      type: "end",
      name: "Ending",
      instruction: { type: "prompt", text: "Thank the caller and end the call." },
      display_position: { x: position.x + 420, y: position.y },
    });
  }

  let node: FlowNodeData;
  switch (kind) {
    case "conversation":
      node = { id, type: "conversation", name: "New conversation", instruction: { type: "prompt", text: "" }, edges: [] };
      break;
    case "end":
      node = { id, type: "end", name: "Ending", instruction: { type: "prompt", text: "Thank the caller and end the call." } };
      break;
    case "branch":
      node = { id, type: "branch", name: "Logic split", edges: [], else_edge: edgeOf(taken, "Else", fallbackId!) };
      break;
    case "press_digit":
      node = { id, type: "press_digit", name: "Press digit", instruction: { type: "prompt", text: "Press 1 to continue" }, edges: [] };
      break;
    case "transfer_call":
      node = {
        id,
        type: "transfer_call",
        name: "Call transfer",
        transfer_destination: { type: "predefined", number: "" },
        transfer_option: { type: "cold_transfer" },
        edge: edgeOf(taken, "Transfer failed", fallbackId!),
      };
      break;
    default:
      node = {
        id,
        type: "extract_dynamic_variables",
        name: "Extract variable",
        variables: [{ type: "string", name: "variable_name", description: "What to extract" }],
        edges: [],
      };
  }
  node.display_position = position;
  return [node, ...added];
}

/** Assigns a left-to-right layered layout, starting from the start node. */
export function autoLayout(nodes: FlowNodeData[], startId: string | null | undefined): FlowNodeData[] {
  const depth = new Map<string, number>();
  const queue: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const first = startId && byId.has(startId) ? startId : nodes[0]?.id;
  if (first) {
    depth.set(first, 0);
    queue.push(first);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const node = byId.get(cur);
    if (!node) continue;
    for (const e of outgoingEdges(node)) {
      const to = e.edge.destination_node_id;
      if (byId.has(to) && !depth.has(to)) {
        depth.set(to, (depth.get(cur) ?? 0) + 1);
        queue.push(to);
      }
    }
  }
  let extra = Math.max(-1, ...depth.values()) + 1;
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, extra++);

  const rows = new Map<number, number>();
  return nodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const row = rows.get(d) ?? 0;
    rows.set(d, row + 1);
    return { ...n, display_position: { x: 120 + d * 440, y: 80 + row * 300 } };
  });
}

export function withPositions(nodes: FlowNodeData[], startId: string | null | undefined): FlowNodeData[] {
  const missing = nodes.some((n) => !n.display_position);
  return missing ? autoLayout(nodes, startId) : nodes;
}

export function validateFlow(nodes: FlowNodeData[], startId: string | null | undefined): string[] {
  const problems: string[] = [];
  const ids = new Set(nodes.map((n) => n.id));
  if (nodes.length === 0) problems.push("The workflow needs at least one node.");
  if (!startId || !ids.has(startId)) problems.push("Choose a start node.");
  for (const n of nodes) {
    const title = nodeTitle(n);
    for (const oe of outgoingEdges(n)) {
      if (!ids.has(oe.edge.destination_node_id)) {
        problems.push(`"${title}": the "${oe.label}" transition needs a destination.`);
      } else if (
        oe.edge.transition_condition?.type === "prompt" &&
        oe.field === "edges" &&
        !oe.edge.transition_condition.prompt?.trim()
      ) {
        problems.push(`"${title}": a transition has no condition text.`);
      }
    }
    if (
      (n.type === "conversation" || n.type === "press_digit") &&
      n.instruction?.type === "prompt" &&
      !n.instruction.text?.trim()
    ) {
      problems.push(`"${title}": add an instruction.`);
    }
    if (n.type === "transfer_call") {
      const dest = n.transfer_destination as { type?: string; number?: string } | undefined;
      if (dest?.type === "predefined" && !dest.number?.trim()) {
        problems.push(`"${title}": enter a phone number to transfer to.`);
      }
    }
  }
  return problems;
}

/** Nodes that still point at `nodeId` through a transition that cannot be removed. */
export function blockingReferences(nodes: FlowNodeData[], nodeId: string): FlowNodeData[] {
  return nodes.filter(
    (n) =>
      n.id !== nodeId &&
      outgoingEdges(n).some((oe) => !oe.removable && oe.edge.destination_node_id === nodeId)
  );
}

/** Removes a node and every removable transition that pointed at it. */
export function removeNode(nodes: FlowNodeData[], nodeId: string): FlowNodeData[] {
  return nodes
    .filter((n) => n.id !== nodeId)
    .map((n) =>
      n.edges?.some((e) => e.destination_node_id === nodeId)
        ? { ...n, edges: n.edges.filter((e) => e.destination_node_id !== nodeId) }
        : n
    );
}

export function mapEdge(
  node: FlowNodeData,
  key: string,
  fn: (e: FlowEdgeData) => FlowEdgeData
): FlowNodeData {
  const oe = outgoingEdges(node).find((x) => x.key === key);
  if (!oe) return node;
  if (oe.field === "edges") {
    return { ...node, edges: (node.edges ?? []).map((e) => (e.id === oe.edge.id ? fn(e) : e)) };
  }
  return { ...node, [oe.field]: fn(oe.edge) };
}

export function removeEdge(node: FlowNodeData, key: string): FlowNodeData {
  const oe = outgoingEdges(node).find((x) => x.key === key);
  if (!oe || !oe.removable) return node;
  return { ...node, edges: (node.edges ?? []).filter((e) => e.id !== oe.edge.id) };
}

export function addTransition(
  node: FlowNodeData,
  nodes: FlowNodeData[],
  destination: string
): FlowNodeData {
  const taken = allIds(nodes);
  return {
    ...node,
    edges: [...(node.edges ?? []), edgeOf(taken, "New condition", destination)],
  };
}

/** Node types that can own a list of conditional transitions. */
export function supportsTransitionList(type: string): boolean {
  return [
    "conversation",
    "subagent",
    "function",
    "code",
    "press_digit",
    "branch",
    "extract_dynamic_variables",
    "mcp",
    "component",
  ].includes(type);
}
