import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlowEdgeData, FlowNodeData, FlowToolData } from "@/hooks/use-agent-flow";
import {
  SINGLE_EDGE_FIELDS,
  addTransition,
  allIds,
  autoLayout,
  blockingReferences,
  conditionLabel,
  createNodes,
  duplicateNode,
  nodeMeta,
  nodeTitle,
  outgoingEdges,
  PALETTE,
  pruneTools,
  randomId,
  removeEdge,
  removeNode,
  mapEdge,
  supportsTransitionList,
  validateFlow,
  withPositions,
  type CreatableKind,
} from "./flow-utils";

/** Compact builders so each test states only the facts it cares about. */
function conversation(
  id: string,
  extra: Partial<FlowNodeData> = {}
): FlowNodeData {
  return {
    id,
    type: "conversation",
    name: id,
    instruction: { type: "prompt", text: "Say hi" },
    edges: [],
    ...extra,
  };
}

function edge(id: string, dest: string, prompt?: string): FlowEdgeData {
  // deliberately allows a missing condition: the module defends against that
  // shape at runtime (old flows saved before conditions were required)
  const e = { id, destination_node_id: dest } as FlowEdgeData;
  if (prompt !== undefined) e.transition_condition = { type: "prompt", prompt };
  return e;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("conditionLabel", () => {
  it("falls back to 'Transition' when there is no condition", () => {
    expect(conditionLabel({ id: "e", transition_condition: undefined as never, destination_node_id: "n" })).toBe("Transition");
  });

  it("shows the prompt text for prompt conditions", () => {
    expect(
      conditionLabel({
        id: "e",
        transition_condition: { type: "prompt", prompt: "caller says yes" },
        destination_node_id: "n",
      })
    ).toBe("caller says yes");
  });

  it("falls back when a prompt condition has blank text", () => {
    expect(
      conditionLabel({
        id: "e",
        transition_condition: { type: "prompt", prompt: "   " },
        destination_node_id: "n",
      })
    ).toBe("Transition");
  });

  it("labels equation conditions and unknown types", () => {
    expect(
      conditionLabel({
        id: "e",
        transition_condition: { type: "equation" },
        destination_node_id: "n",
      })
    ).toBe("Equation condition");
    expect(
      conditionLabel({
        id: "e",
        transition_condition: { type: "something_new" },
        destination_node_id: "n",
      })
    ).toBe("Transition");
  });
});

describe("outgoingEdges", () => {
  it("lists removable edge entries first, then single-edge fields", () => {
    const node: FlowNodeData = {
      ...conversation("n1"),
      edges: [edge("e1", "a", "yes"), edge("e2", "b")],
      else_edge: edge("s1", "c"),
      success_edge: edge("s2", "d"),
    };
    const out = outgoingEdges(node);

    expect(out.map((o) => o.key)).toEqual(["edges:e1", "edges:e2", "else_edge", "success_edge"]);
    expect(out.map((o) => o.removable)).toEqual([true, true, false, false]);
    expect(out.map((o) => o.label)).toEqual(["yes", "Transition", "Else", "Sent successfully"]);
  });

  it("uses the list index when an edge has no id", () => {
    const node = conversation("n1", {
      edges: [{ id: undefined as never, transition_condition: { type: "prompt", prompt: "p" }, destination_node_id: "x" }],
    });
    expect(outgoingEdges(node)[0].key).toBe("edges:0");
  });

  it("handles nodes with no edges at all", () => {
    expect(outgoingEdges(conversation("n1"))).toEqual([]);
    expect(outgoingEdges({ id: "n2", type: "end" })).toEqual([]);
  });

  it("prefers the condition prompt over the static label for single fields", () => {
    const node = conversation("n1", {
      else_edge: { id: "s1", transition_condition: { type: "prompt", prompt: "custom else" }, destination_node_id: "x" },
    });
    expect(outgoingEdges(node)[0].label).toBe("custom else");
  });
});

describe("nodeMeta / nodeTitle", () => {
  it("returns the registered meta for known types", () => {
    expect(nodeMeta("branch").label).toBe("Logic Split");
    expect(nodeMeta("subagent").creatable).toBe(false);
    expect(nodeMeta("conversation").creatable).toBe(true);
  });

  it("falls back to a humanised label for unknown types", () => {
    const meta = nodeMeta("brand_new_thing");
    expect(meta.label).toBe("brand new thing");
    expect(meta.creatable).toBe(false);
    expect(meta.tone).toContain("bg-gray-50");
  });

  it("prefers a trimmed node name, otherwise the type label", () => {
    expect(nodeTitle({ id: "n", type: "branch", name: "  Ask zip  " })).toBe("Ask zip");
    expect(nodeTitle({ id: "n", type: "branch", name: "   " })).toBe("Logic Split");
    expect(nodeTitle({ id: "n", type: "branch" })).toBe("Logic Split");
    expect(nodeTitle({ id: "n", type: "brand_new_thing" })).toBe("brand new thing");
  });
});

describe("randomId", () => {
  it("returns an id outside the taken set", () => {
    const taken = new Set(["a-1", "a-2"]);
    const id = randomId("a", taken);
    expect(id.startsWith("a-")).toBe(true);
    expect(taken.has(id)).toBe(false);
  });

  it("falls back to a timestamp when randomness keeps colliding", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    const collide = `n-${(0.42).toString(36).slice(2, 8)}`;
    expect(randomId("n", new Set([collide]))).toBe("n-1700000000000");
  });
});

describe("allIds", () => {
  it("collects node ids and every outgoing edge id", () => {
    const nodes: FlowNodeData[] = [
      conversation("n1", { edges: [edge("e1", "n2")], else_edge: edge("s1", "n2") }),
      conversation("n2"),
    ];
    expect([...allIds(nodes)].sort()).toEqual(["e1", "n1", "n2", "s1"]);
  });
});

describe("createNodes", () => {
  it.each<CreatableKind>(PALETTE)("creates a node of the requested kind without collisions: %s", (kind) => {
    const existing = [conversation("taken")];
    const { nodes } = createNodes(kind, existing, { x: 10, y: 20 });

    const created = nodes.find((n) => n.type !== "end" || kind === "end");
    expect(created).toBeDefined();
    expect(created!.id).not.toBe("taken");
    expect(created!.display_position).toEqual({ x: 10, y: 20 });
    // every transition it created must point at a node that exists in the result
    const ids = new Set(nodes.map((n) => n.id));
    for (const n of nodes) {
      for (const oe of outgoingEdges(n)) {
        expect(ids.has(oe.edge.destination_node_id)).toBe(true);
      }
    }
  });

  it("adds a shared Ending node when a kind needs a fallback and none exists", () => {
    const { nodes } = createNodes("branch", [conversation("n1")], { x: 0, y: 0 });
    expect(nodes).toHaveLength(2);
    const [branch, ending] = nodes;
    expect(branch.type).toBe("branch");
    expect(ending.type).toBe("end");
    expect(branch.else_edge!.destination_node_id).toBe(ending.id);
    expect(ending.display_position).toEqual({ x: 420, y: 0 });
  });

  it("reuses an existing Ending node as the fallback instead of adding one", () => {
    const { nodes } = createNodes("sms", [conversation("n1"), { id: "end1", type: "end" }], { x: 0, y: 0 });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].success_edge!.destination_node_id).toBe("end1");
    expect(nodes[0].failed_edge!.destination_node_id).toBe("end1");
  });

  it("does not create a fallback for kinds that do not need one", () => {
    for (const kind of ["conversation", "code", "press_digit", "end", "extract_dynamic_variables"] as CreatableKind[]) {
      const { nodes } = createNodes(kind, [], { x: 0, y: 0 });
      expect(nodes).toHaveLength(1);
    }
  });

  it("gives a function node a fresh tool with a non-colliding name", () => {
    const existingTools: FlowToolData[] = [
      { tool_id: "t1", type: "custom", name: "custom_function_1", url: "" },
      { tool_id: "t2", type: "custom", name: "custom_function_2", url: "" },
    ];
    const { nodes, tools } = createNodes("function", [], { x: 0, y: 0 }, existingTools);

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("custom_function_3");
    expect(tools[0].tool_id).not.toBe("t1");
    expect(nodes[0].tool_id).toBe(tools[0].tool_id);
    expect(nodes[0].tool_type).toBe("local");
  });

  it("starts tool numbering at 1 when no custom functions exist yet", () => {
    const { tools } = createNodes("function", [], { x: 0, y: 0 }, [
      { tool_id: "t1", type: "custom", name: "some_other_tool", url: "" },
    ]);
    expect(tools[0].name).toBe("custom_function_1");
  });
});

describe("duplicateNode", () => {
  it("copies a node with fresh ids, a copy name and an offset position", () => {
    const source = conversation("n1", {
      name: "Greeting",
      display_position: { x: 100, y: 200 },
      edges: [edge("e1", "other")],
    });
    const { node, tool } = duplicateNode(source, [source], []);

    expect(node.id).not.toBe("n1");
    expect(node.name).toBe("Greeting copy");
    expect(node.display_position).toEqual({ x: 140, y: 260 });
    expect(node.edges![0].id).not.toBe("e1");
    expect(node.edges![0].destination_node_id).toBe("other");
    expect(tool).toBeUndefined();
  });

  it("defaults the copy position when the source has none", () => {
    const source = conversation("n1");
    const { node } = duplicateNode(source, [source], []);
    expect(node.display_position).toEqual({ x: 40, y: 60 });
  });

  it("regenerates ids for single-edge fields too", () => {
    const source = conversation("n1", { else_edge: edge("s1", "x") });
    const { node } = duplicateNode(source, [source], []);
    expect(node.else_edge!.id).not.toBe("s1");
  });

  it("duplicates the tool of a function node with a unique name", () => {
    const source: FlowNodeData = {
      id: "f1",
      type: "function",
      name: "Check CRM",
      tool_id: "t1",
      tool_type: "local",
      edges: [],
    };
    const tools: FlowToolData[] = [
      { tool_id: "t1", type: "custom", name: "check_crm", url: "https://x.test" },
      { tool_id: "t2", type: "custom", name: "check_crm_1", url: "" },
    ];
    const { node, tool } = duplicateNode(source, [source], tools);

    expect(tool!.name).toBe("check_crm_2");
    expect(tool!.tool_id).not.toBe("t1");
    expect(node.tool_id).toBe(tool!.tool_id);
    // the original still points at the original tool
    expect(source.tool_id).toBe("t1");
  });
});

describe("pruneTools", () => {
  const tools: FlowToolData[] = [
    { tool_id: "used", type: "custom", name: "a", url: "" },
    { tool_id: "orphan", type: "custom", name: "b", url: "" },
    { tool_id: "untouched", type: "custom", name: "c", url: "" },
  ];

  it("drops candidate tools no node refers to", () => {
    const nodes = [{ id: "n1", type: "function", tool_id: "used" } as FlowNodeData];
    const result = pruneTools(nodes, tools, ["used", "orphan"]);
    expect(result.map((t) => t.tool_id)).toEqual(["used", "untouched"]);
  });

  it("keeps tools that are not candidates even when unused", () => {
    expect(pruneTools([], tools, ["orphan"]).map((t) => t.tool_id)).toEqual(["used", "untouched"]);
  });

  it("keeps tools referenced through a tool_ids list (multi-tool nodes)", () => {
    const nodes = [{ id: "n1", type: "mcp", tool_ids: ["orphan"] } as unknown as FlowNodeData];
    const result = pruneTools(nodes, tools, ["orphan"]);
    expect(result.map((t) => t.tool_id)).toEqual(["used", "orphan", "untouched"]);
  });

  it("prunes nothing when given no candidates", () => {
    expect(pruneTools([], tools, [])).toHaveLength(3);
  });
});

describe("autoLayout", () => {
  it("lays reachable nodes out left to right from the start node", () => {
    const nodes: FlowNodeData[] = [
      conversation("n2", { edges: [edge("e2", "n3")] }),
      conversation("n3"),
      conversation("n1", { edges: [edge("e1", "n2")] }),
    ];
    const laid = autoLayout(nodes, "n1");
    const pos = Object.fromEntries(laid.map((n) => [n.id, n.display_position]));

    expect(pos.n1).toEqual({ x: 120, y: 80 });
    expect(pos.n2).toEqual({ x: 560, y: 80 });
    expect(pos.n3).toEqual({ x: 1000, y: 80 });
  });

  it("stacks nodes sharing a depth into rows", () => {
    const nodes: FlowNodeData[] = [
      conversation("start", { edges: [edge("e1", "a"), edge("e2", "b")] }),
      conversation("a"),
      conversation("b"),
    ];
    const laid = autoLayout(nodes, "start");
    const pos = Object.fromEntries(laid.map((n) => [n.id, n.display_position])) as Record<
      string,
      { x: number; y: number }
    >;

    expect(pos.a.y).toBe(80);
    expect(pos.b.y).toBe(380);
    expect(pos.a.x).toBe(pos.b.x);
  });

  it("places unreachable nodes after the reachable ones", () => {
    const nodes = [conversation("a"), { id: "island", type: "end" } as FlowNodeData];
    const laid = autoLayout(nodes, "a");
    const island = laid.find((n) => n.id === "island")!;
    expect(island.display_position).toEqual({ x: 560, y: 80 });
  });

  it("falls back to the first node when the start id is unknown", () => {
    const laid = autoLayout([conversation("a"), conversation("b")], "nope");
    expect(laid[0].display_position).toEqual({ x: 120, y: 80 });
  });

  it("handles cycles without hanging and keeps every node placed", () => {
    const nodes: FlowNodeData[] = [
      conversation("a", { edges: [edge("e1", "b")] }),
      conversation("b", { edges: [edge("e2", "a")] }),
    ];
    const laid = autoLayout(nodes, "a");
    expect(laid).toHaveLength(2);
    expect(laid.every((n) => n.display_position !== undefined)).toBe(true);
  });

  it("ignores transitions pointing outside the graph", () => {
    const laid = autoLayout([conversation("a", { edges: [edge("e1", "ghost")] })], "a");
    expect(laid[0].display_position).toEqual({ x: 120, y: 80 });
  });

  it("returns an empty list for an empty graph", () => {
    expect(autoLayout([], "anything")).toEqual([]);
  });
});

describe("withPositions", () => {
  it("keeps authored positions when every node has one", () => {
    const nodes = [conversation("a", { display_position: { x: 5, y: 6 } })];
    expect(withPositions(nodes, "a")).toBe(nodes);
  });

  it("recomputes all positions when any node is missing one", () => {
    const nodes = [
      conversation("a", { display_position: { x: 5, y: 6 } }),
      conversation("b"),
    ];
    const result = withPositions(nodes, "a");
    expect(result.find((n) => n.id === "a")!.display_position).toEqual({ x: 120, y: 80 });
  });
});

describe("validateFlow", () => {
  it("returns no problems for a healthy flow", () => {
    const nodes: FlowNodeData[] = [
      conversation("start", { edges: [edge("e1", "end", "wrap up")] }),
      { id: "end", type: "end", name: "End" } as FlowNodeData,
    ];
    expect(validateFlow(nodes, "start")).toEqual([]);
  });

  it("requires at least one node and a valid start node", () => {
    expect(validateFlow([], null)).toEqual([
      "The workflow needs at least one node.",
      "Choose a start node.",
    ]);
    expect(validateFlow([conversation("a")], "ghost")).toEqual(["Choose a start node."]);
    expect(validateFlow([conversation("a")], null)).toEqual(["Choose a start node."]);
  });

  it("flags transitions pointing at missing destinations", () => {
    const nodes = [conversation("Reception", { edges: [edge("e1", "ghost", "yes")] })];
    expect(validateFlow(nodes, "Reception")).toEqual([
      '"Reception": the "yes" transition needs a destination.',
    ]);
  });

  it("flags a conditional transition with no condition text", () => {
    const nodes = [conversation("Reception", { edges: [edge("e1", "Reception", "   ")] })];
    expect(validateFlow(nodes, "Reception")).toEqual([
      '"Reception": a transition has no condition text.',
    ]);
  });

  it("accepts blank prompt text on single-edge fields (they have static labels)", () => {
    const nodes = [conversation("Reception", { else_edge: edge("s1", "Reception", "") })];
    expect(validateFlow(nodes, "Reception")).toEqual([]);
  });

  it("requires an instruction for conversation and press_digit nodes", () => {
    const nodes: FlowNodeData[] = [
      { id: "c1", type: "conversation", name: "Chat", instruction: { type: "prompt", text: "  " } } as FlowNodeData,
      { id: "p1", type: "press_digit", name: "Keys", instruction: { type: "prompt", text: "" } } as FlowNodeData,
    ];
    expect(validateFlow(nodes, "c1")).toEqual([
      '"Chat": add an instruction.',
      '"Keys": add an instruction.',
    ]);
  });

  it("checks a function node's tool: missing, bad name, bad url", () => {
    const missing: FlowNodeData = { id: "f1", type: "function", name: "CRM", tool_id: "nope" } as FlowNodeData;
    expect(validateFlow([missing], "f1", [])).toEqual(['"CRM": its function is missing.']);

    const badName: FlowNodeData = { id: "f1", type: "function", name: "CRM", tool_id: "t1" } as FlowNodeData;
    const tools: FlowToolData[] = [
      { tool_id: "t1", type: "custom", name: "my tool!", url: "https://ok.test" },
    ];
    expect(validateFlow([badName], "f1", tools)).toEqual([
      '"CRM": use letters, numbers, underscores and dashes only (64 characters at most).',
    ]);

    const badUrl: FlowToolData[] = [{ tool_id: "t1", type: "custom", name: "ok_name", url: "not-a-url" }];
    expect(validateFlow([badName], "f1", badUrl)).toEqual([
      '"CRM": enter a full URL starting with http:// or https://.',
    ]);
  });

  it("flags duplicate tool names across the flow", () => {
    const node: FlowNodeData = { id: "f1", type: "function", name: "A", tool_id: "t1" } as FlowNodeData;
    const tools: FlowToolData[] = [
      { tool_id: "t1", type: "custom", name: "shared", url: "https://ok.test" },
      { tool_id: "t2", type: "custom", name: "shared", url: "https://ok.test" },
    ];
    expect(validateFlow([node], "f1", tools)).toEqual([
      '"A": "shared" is already used by another function.',
    ]);
  });

  it("does not require a url for non-custom tools", () => {
    const node: FlowNodeData = { id: "f1", type: "function", name: "A", tool_id: "t1" } as FlowNodeData;
    const tools: FlowToolData[] = [{ tool_id: "t1", type: "webhook", name: "ok_name" }];
    expect(validateFlow([node], "f1", tools)).toEqual([]);
  });

  it("requires code, SMS text and a target agent for their node types", () => {
    const nodes: FlowNodeData[] = [
      { id: "c", type: "code", name: "Script", code: "   " } as FlowNodeData,
      { id: "s", type: "sms", name: "Text", instruction: { type: "static_text", text: "" } } as FlowNodeData,
      { id: "a", type: "agent_swap", name: "Swap", agent_id: "  " } as FlowNodeData,
    ];
    expect(validateFlow(nodes, "c")).toEqual([
      '"Script": add the code to run.',
      '"Text": add the SMS text or prompt.',
      '"Swap": choose the agent to transfer to.',
    ]);
  });

  it("validates transfer destinations by their type", () => {
    const inferred: FlowNodeData = {
      id: "t1",
      type: "transfer_call",
      name: "Transfer",
      transfer_destination: { type: "inferred" },
    } as FlowNodeData;
    expect(validateFlow([inferred], "t1")).toEqual([
      '"Transfer": describe how to find the number to transfer to.',
    ]);

    const badPhone: FlowNodeData = {
      id: "t1",
      type: "transfer_call",
      name: "Transfer",
      transfer_destination: { type: "predefined", number: "555-1234" },
    } as FlowNodeData;
    expect(validateFlow([badPhone], "t1")).toEqual([
      '"Transfer": start with + and the country code, e.g. +14155551234.',
    ]);

    const emptyPhone: FlowNodeData = {
      id: "t1",
      type: "transfer_call",
      name: "Transfer",
      transfer_destination: { type: "predefined", number: "" },
    } as FlowNodeData;
    expect(validateFlow([emptyPhone], "t1")).toEqual(['"Transfer": enter a phone number.']);

    const ok: FlowNodeData = {
      id: "t1",
      type: "transfer_call",
      name: "Transfer",
      transfer_destination: { type: "predefined", number: "+14155551234" },
    } as FlowNodeData;
    expect(validateFlow([ok], "t1")).toEqual([]);
  });

  it("reports every problem on a multi-problem flow", () => {
    const nodes: FlowNodeData[] = [
      conversation("start", { edges: [edge("e1", "ghost", "go")] }),
      { id: "code1", type: "code", name: "Job", code: "" } as FlowNodeData,
    ];
    const problems = validateFlow(nodes, "start");
    expect(problems).toEqual([
      '"start": the "go" transition needs a destination.',
      '"Job": add the code to run.',
    ]);
  });
});

describe("blockingReferences / removeNode", () => {
  const target = conversation("victim");

  it("reports only non-removable references from other nodes", () => {
    const nodes: FlowNodeData[] = [
      conversation("viaList", { edges: [edge("e1", "victim")] }),
      conversation("viaElse", { else_edge: edge("s1", "victim") }),
      conversation("self", { else_edge: edge("s2", "self") }),
      target,
    ];
    expect(blockingReferences(nodes, "victim").map((n) => n.id)).toEqual(["viaElse"]);
  });

  it("returns nothing when only removable edges point at the node", () => {
    const nodes = [conversation("a", { edges: [edge("e1", "victim")] }), target];
    expect(blockingReferences(nodes, "victim")).toEqual([]);
  });

  it("removes the node and every list edge pointing at it", () => {
    const nodes: FlowNodeData[] = [
      conversation("a", { edges: [edge("e1", "victim"), edge("e2", "b")] }),
      conversation("b", { else_edge: edge("s1", "victim") }),
      target,
    ];
    const result = removeNode(nodes, "victim");

    expect(result.map((n) => n.id)).toEqual(["a", "b"]);
    expect(result[0].edges!.map((e) => e.id)).toEqual(["e2"]);
    // single-edge fields are structural: left untouched (hence blockingReferences)
    expect(result[1].else_edge!.destination_node_id).toBe("victim");
  });

  it("does not mutate the input array or its nodes", () => {
    const nodes = [conversation("a", { edges: [edge("e1", "victim")] }), target];
    removeNode(nodes, "victim");
    expect(nodes).toHaveLength(2);
    expect(nodes[0].edges).toHaveLength(1);
  });

  it("is a no-op for an unknown node id", () => {
    const nodes = [conversation("a")];
    expect(removeNode(nodes, "ghost")).toHaveLength(1);
  });
});

describe("mapEdge / removeEdge / addTransition", () => {
  it("maps a list edge by key and leaves other edges alone", () => {
    const node = conversation("n1", {
      edges: [edge("e1", "a"), edge("e2", "b")],
    });
    const next = mapEdge(node, "edges:e2", (e) => ({ ...e, destination_node_id: "c" }));

    expect(next.edges![0].destination_node_id).toBe("a");
    expect(next.edges![1].destination_node_id).toBe("c");
    // original untouched (pure function)
    expect(node.edges![1].destination_node_id).toBe("b");
  });

  it("maps single-edge fields through their field name", () => {
    const node = conversation("n1", { else_edge: edge("s1", "a") });
    const next = mapEdge(node, "else_edge", (e) => ({ ...e, destination_node_id: "z" }));
    expect(next.else_edge!.destination_node_id).toBe("z");
  });

  it("returns the same node object for an unknown key", () => {
    const node = conversation("n1");
    expect(mapEdge(node, "nope", (e) => e)).toBe(node);
  });

  it("removes only removable edges", () => {
    const node = conversation("n1", { edges: [edge("e1", "a")], else_edge: edge("s1", "b") });

    expect(removeEdge(node, "else_edge")).toBe(node);
    const trimmed = removeEdge(node, "edges:e1");
    expect(trimmed.edges).toEqual([]);
    expect(trimmed.else_edge).toBeDefined();
    expect(removeEdge(node, "missing-key")).toBe(node);
  });

  it("appends a transition whose id cannot collide with existing ids", () => {
    const nodes = [conversation("n1", { edges: [edge("e1", "a")] })];
    const next = addTransition(nodes[0], nodes, "target");

    expect(next.edges).toHaveLength(2);
    const added = next.edges![1];
    expect(added.destination_node_id).toBe("target");
    expect(added.transition_condition).toEqual({ type: "prompt", prompt: "New condition" });
    expect(allIds(nodes).has(added.id)).toBe(false);
  });

  it("works on a node that has no edge list yet", () => {
    const nodes = [{ id: "solo", type: "end" } as FlowNodeData];
    const next = addTransition(nodes[0], nodes, "x");
    expect(next.edges).toHaveLength(1);
  });
});

describe("supportsTransitionList", () => {
  it("accepts the node types that own conditional lists", () => {
    for (const type of ["conversation", "function", "code", "branch", "press_digit", "mcp", "subagent", "component", "extract_dynamic_variables"]) {
      expect(supportsTransitionList(type)).toBe(true);
    }
  });

  it("rejects types whose transitions are structural", () => {
    for (const type of ["end", "transfer_call", "sms", "agent_swap", "branch_unknown"]) {
      expect(supportsTransitionList(type)).toBe(false);
    }
  });
});

describe("SINGLE_EDGE_FIELDS", () => {
  it("contains exactly the structural transition fields", () => {
    expect([...SINGLE_EDGE_FIELDS]).toEqual([
      "else_edge",
      "skip_response_edge",
      "always_edge",
      "edge",
      "success_edge",
      "failed_edge",
    ]);
  });
});
