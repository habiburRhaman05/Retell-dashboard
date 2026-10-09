import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";

async function verifyOwnership(locationId: string, agentId: string) {
  const mapping = await prisma.locationAgent.findUnique({
    where: {
      locationId_retellAgentId: { locationId, retellAgentId: agentId },
    },
  });
  return !!mapping;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId");

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId is required" },
      { status: 400 }
    );
  }

  const hasAccess = await verifyOwnership(locationId, agentId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Agent not found" }, { status: 403 });
  }

  try {
    const agent = await retell.getAgent(agentId);
    return NextResponse.json(agent);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch agent";
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
    const { locationId, ...updateData } = body;

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 }
      );
    }

    const hasAccess = await verifyOwnership(locationId, agentId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }

    const agent = await retell.updateAgent(agentId, updateData);

    if (agent.agent_name) {
      await prisma.locationAgent.updateMany({
        where: { locationId, retellAgentId: agentId },
        data: { agentName: agent.agent_name },
      });
    }

    return NextResponse.json(agent);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId");

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId is required" },
      { status: 400 }
    );
  }

  const hasAccess = await verifyOwnership(locationId, agentId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Agent not found" }, { status: 403 });
  }

  try {
    await retell.deleteAgent(agentId);
    // Hidden test-chat agent (if any) goes with it. Never block deletion on this.
    await retell.deleteTestChatAgents(agentId).catch(() => undefined);
    await prisma.locationAgent.deleteMany({
      where: { locationId, retellAgentId: agentId },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
