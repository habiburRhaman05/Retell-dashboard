import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { buildFlowPayload, fillTemplate, getTemplate } from "@/lib/agent-templates";

interface CreateBody {
  locationId?: string;
  name?: string;
  type?: "single" | "flow";
  templateId?: string | null;
  businessName?: string;
  voiceId?: string;
  language?: string | string[];
}

const BLANK_PROMPT = `## Identity
You are {{agent}}, a helpful AI voice assistant for {{business}}.

## Style
- Speak in short, natural sentences. This is a phone call, so never use lists or markdown.
- Ask one question at a time.
- If you do not know something, say so.`;

export async function POST(request: NextRequest) {
  let createdLlmId: string | null = null;
  let createdFlowId: string | null = null;
  let createdAgentId: string | null = null;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const { locationId, type = "single" } = body;
    const name = body.name?.trim();
    const business = body.businessName?.trim() || "";

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }
    if (!body.voiceId) {
      return NextResponse.json({ error: "Please choose a voice" }, { status: 400 });
    }
    if (type !== "single" && type !== "flow") {
      return NextResponse.json({ error: "Invalid agent type" }, { status: 400 });
    }

    const template = body.templateId ? getTemplate(body.templateId) : undefined;
    if (body.templateId && !template) {
      return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }
    if (type === "flow" && template && !template.flow) {
      return NextResponse.json(
        { error: "This template is not available as a conversational flow" },
        { status: 400 }
      );
    }

    let responseEngine: Record<string, unknown>;

    if (type === "flow") {
      const flowDef = template?.flow ?? {
        globalPrompt: "You are {{agent}}, a helpful AI voice assistant for {{business}}.",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            name: "Greeting",
            prompt: "Greet the caller and ask how you can help.",
            edges: [{ to: "end", when: "The conversation is finished" }],
          },
          { id: "end", name: "End call", end: true, prompt: "Thank the caller and end the call." },
        ],
      };
      const flow = await retell.createConversationFlow(
        buildFlowPayload(flowDef, name, business)
      );
      createdFlowId = flow.conversation_flow_id;
      responseEngine = { type: "conversation-flow", conversation_flow_id: createdFlowId };
    } else {
      const llm = await retell.createRetellLlmFromTemplate({
        general_prompt: fillTemplate(template?.prompt ?? BLANK_PROMPT, name, business),
        begin_message: fillTemplate(
          template?.beginMessage ?? "Hi, this is {{agent}}. How can I help you today?",
          name,
          business
        ),
        start_speaker: "agent",
      });
      createdLlmId = llm.llm_id;
      responseEngine = { type: "retell-llm", llm_id: createdLlmId };
    }

    const agent = await retell.createAgentRaw({
      agent_name: name,
      response_engine: responseEngine,
      voice_id: body.voiceId,
      language: body.language ?? "en-US",
      assigned_tags: [`loc:${locationId}`],
    });
    createdAgentId = agent.agent_id;

    await prisma.location.upsert({
      where: { locationId },
      create: { locationId },
      update: {},
    });
    await prisma.locationAgent.create({
      data: { locationId, retellAgentId: agent.agent_id, agentName: agent.agent_name },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    // Roll back anything already created in Retell so a failed attempt does
    // not leave orphaned agents, LLMs or flows behind.
    await Promise.allSettled([
      createdAgentId ? retell.deleteAgent(createdAgentId) : Promise.resolve(),
    ]);
    await Promise.allSettled([
      createdLlmId ? retell.deleteRetellLlm(createdLlmId) : Promise.resolve(),
      createdFlowId ? retell.deleteConversationFlow(createdFlowId) : Promise.resolve(),
    ]);
    const message = error instanceof Error ? error.message : "Failed to create agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
