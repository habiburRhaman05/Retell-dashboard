import { withTenantRoute } from "@/modules/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import type { SimulationEngine } from "@/lib/retell-api";

const SIM_MODELS = ["gpt-4.1", "gpt-5", "claude-4.6-sonnet", "gemini-3.0-flash"];

async function ownAgent(locationId: string, agentId: string) {
  const mapping = await prisma.locationAgent.findUnique({
    where: { locationId_retellAgentId: { locationId, retellAgentId: agentId } },
  });
  return !!mapping;
}

async function engineOf(agentId: string): Promise<SimulationEngine> {
  const agent = await retell.getAnyAgent(agentId);
  const e = agent.response_engine;
  if (e.type === "retell-llm" && e.llm_id) {
    return { type: "retell-llm", llm_id: e.llm_id, version: e.version ?? 0 };
  }
  if (e.type === "conversation-flow" && e.conversation_flow_id) {
    return { type: "conversation-flow", conversation_flow_id: e.conversation_flow_id, version: e.version ?? 0 };
  }
  throw new Error("Simulated chats work with Retell LLM and conversational flow agents only");
}

/** A batch belongs to this agent only if it ran against this agent's own engine. */
async function batchBelongsTo(batchId: string, engine: SimulationEngine) {
  const batch = await retell.getBatchTest(batchId);
  const b = batch.response_engine;
  return b.llm_id === engine.llm_id && b.conversation_flow_id === engine.conversation_flow_id;
}

// Retell hands back some transcripts with UTF-8 read as Windows-1252, which
// turns an apostrophe into three odd characters. Undo that so text reads properly.
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
function fixMojibake(text: string): string {
  if (!/[ÂÃâ]/.test(text)) return text;
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (code < 0x100) bytes.push(code);
    else if (CP1252[code] !== undefined) bytes.push(CP1252[code]);
    else return text;
  }
  const fixed = Buffer.from(bytes).toString("utf8");
  return fixed.includes("�") ? text : fixed;
}

async function cleanup(runs: retell.TestRun[]) {
  const ids = [...new Set(runs.map((r) => r.test_case_definition_id))];
  await Promise.allSettled(ids.map((id) => retell.deleteTestCaseDefinition(id)));
}

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  let definitionId: string | null = null;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      locationId?: string;
      userPrompt?: string;
      metrics?: string[];
      dynamicVariables?: Record<string, string>;
      model?: string;
    };
    const { locationId } = body;
    const userPrompt = body.userPrompt?.trim();
    if (!locationId) return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    if (!userPrompt || userPrompt.length < 10) {
      return NextResponse.json(
        { error: "Describe the caller in a sentence or two, for example who they are and what they want." },
        { status: 400 }
      );
    }
    if (!(await ownAgent(locationId, agentId))) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }

    const metrics = (body.metrics ?? []).map((m) => m.trim()).filter(Boolean);
    const model = SIM_MODELS.includes(body.model ?? "") ? (body.model as string) : "gpt-4.1";
    const engine = await engineOf(agentId);

    // A throwaway test case, removed again as soon as the run finishes, so
    // simulations never pile up in the Retell account.
    const def = await retell.createTestCaseDefinition({
      name: `Test chat ${new Date().toISOString().slice(0, 16)}`,
      response_engine: engine,
      user_prompt: userPrompt,
      metrics: metrics.length ? metrics : ["The agent handles the conversation helpfully and stays on topic."],
      dynamic_variables: body.dynamicVariables ?? {},
      llm_model: model,
    });
    definitionId = def.test_case_definition_id;
    const batch = await retell.createBatchTest([definitionId], engine);
    return NextResponse.json({ batchId: batch.test_case_batch_job_id }, { status: 201 });
  } catch (error) {
    if (definitionId) await retell.deleteTestCaseDefinition(definitionId).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Could not start the simulation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId");
  const batchId = request.nextUrl.searchParams.get("batchId");
  if (!locationId || !batchId) {
    return NextResponse.json({ error: "locationId and batchId are required" }, { status: 400 });
  }
  try {
    if (!(await ownAgent(locationId, agentId))) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }
    if (!(await batchBelongsTo(batchId, await engineOf(agentId)))) {
      return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
    }
    const runs = await retell.listTestRuns(batchId);
    const run = runs[0];
    if (!run) return NextResponse.json({ status: "pending", done: false, transcript: [], explanation: null });

    const done = run.status === "pass" || run.status === "fail" || run.status === "error";
    const transcript = (run.transcript_snapshot?.transcript ?? []).map((m) => ({
      ...m,
      content: typeof m.content === "string" ? fixMojibake(m.content) : m.content,
    }));
    if (done) await cleanup(runs);
    return NextResponse.json({
      status: run.status,
      done,
      transcript,
      explanation: run.result_explanation ? fixMojibake(run.result_explanation) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the simulation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Cancel: remove the run's throwaway test case. */
async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId");
  const batchId = request.nextUrl.searchParams.get("batchId");
  if (!locationId || !batchId) {
    return NextResponse.json({ error: "locationId and batchId are required" }, { status: 400 });
  }
  try {
    if (!(await ownAgent(locationId, agentId))) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }
    if (await batchBelongsTo(batchId, await engineOf(agentId))) {
      await cleanup(await retell.listTestRuns(batchId));
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withTenantRoute(handlePOST);
export const GET = withTenantRoute(handleGET);
export const DELETE = withTenantRoute(handleDELETE);
