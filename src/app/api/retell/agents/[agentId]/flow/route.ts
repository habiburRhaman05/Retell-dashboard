import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";

// The flow is always resolved from the agent's own response engine, so a
// caller can never read or change a flow that belongs to another agent.
async function resolveFlow(locationId: string, agentId: string) {
  const mapping = await prisma.locationAgent.findUnique({
    where: { locationId_retellAgentId: { locationId, retellAgentId: agentId } },
  });
  if (!mapping) return { error: NextResponse.json({ error: "Agent not found" }, { status: 403 }) };

  const agent = await retell.getAnyAgent(agentId);
  const engine = agent.response_engine;
  if (engine.type !== "conversation-flow" || !engine.conversation_flow_id) {
    return {
      error: NextResponse.json(
        { error: "This agent does not use a conversational flow" },
        { status: 400 }
      ),
    };
  }
  return { flowId: engine.conversation_flow_id, version: engine.version };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }
  try {
    const r = await resolveFlow(locationId, agentId);
    if ("error" in r) return r.error;
    const flow = await retell.getConversationFlow(r.flowId, r.version);
    return NextResponse.json(flow);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  try {
    const body = await request.json();
    const { locationId, ...patch } = body as { locationId?: string } & Record<string, unknown>;
    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }
    const r = await resolveFlow(locationId, agentId);
    if ("error" in r) return r.error;
    const flow = await retell.updateConversationFlow(r.flowId, patch, r.version);
    return NextResponse.json(flow);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
