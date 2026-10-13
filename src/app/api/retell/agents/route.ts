import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { getLocationName } from "@/lib/location-name";
import { withLocationName } from "@/lib/naming";
import { nameTakenInLocation } from "@/lib/agent-name-check";
import { duplicateAgentMessage } from "@/lib/agent-names";
import { checkLimitForLocation } from "@/modules/limits";

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json(
      { error: "locationId is required" },
      { status: 400 }
    );
  }

  try {
    const mappings = await prisma.locationAgent.findMany({
      where: { locationId },
      select: { retellAgentId: true },
    });

    if (mappings.length === 0) {
      return NextResponse.json([]);
    }

    const allAgents = await retell.listAllAgents();
    const voiceAgents = allAgents.filter(
      (a) => (a.channel === "voice" || a.channel === "chat") && !retell.isHiddenTestChatAgent(a)
    );

    const agentIds = new Set(mappings.map((m) => m.retellAgentId));
    const locationAgents = voiceAgents.filter((a) =>
      agentIds.has(a.agent_id)
    );

    const foundIds = new Set(locationAgents.map((a) => a.agent_id));
    const orphanIds = [...agentIds].filter((id) => !foundIds.has(id));
    if (orphanIds.length > 0) {
      await prisma.locationAgent.deleteMany({
        where: {
          locationId,
          retellAgentId: { in: orphanIds },
        },
      });
    }

    return NextResponse.json(await retell.hydrateAgents(locationAgents));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list agents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, ...agentData } = body;

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 }
      );
    }

    const limitCheck = await checkLimitForLocation(locationId, "AGENTS", 1);
    if (limitCheck.status === "block") {
      return NextResponse.json(
        { error: limitCheck.message, code: "LIMIT_REACHED" },
        { status: 403 }
      );
    }

    if (typeof agentData.agent_name === "string" && agentData.agent_name.trim()) {
      agentData.agent_name = withLocationName(agentData.agent_name, await getLocationName(locationId)).full;
      if (await nameTakenInLocation(locationId, agentData.agent_name)) {
        return NextResponse.json({ error: duplicateAgentMessage(agentData.agent_name) }, { status: 409 });
      }
    }

    const tags = [`loc:${locationId}`];
    if (agentData.assigned_tags) {
      tags.push(...agentData.assigned_tags);
    }
    agentData.assigned_tags = tags;

    const agent = await retell.createAgent(agentData);

    await prisma.location.upsert({
      where: { locationId },
      create: { locationId },
      update: {},
    });

    await prisma.locationAgent.create({
      data: {
        locationId,
        retellAgentId: agent.agent_id,
        agentName: agent.agent_name,
      },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
