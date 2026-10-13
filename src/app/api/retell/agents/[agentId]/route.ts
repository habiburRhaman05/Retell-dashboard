import { withTenantRoute } from "@/modules/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { nameTakenInLocation } from "@/lib/agent-name-check";
import { duplicateAgentMessage } from "@/lib/agent-names";

async function verifyOwnership(locationId: string, agentId: string) {
  const mapping = await prisma.locationAgent.findUnique({
    where: {
      locationId_retellAgentId: { locationId, retellAgentId: agentId },
    },
  });
  return !!mapping;
}

async function handleGET(
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
    const agent = await retell.getAnyAgent(agentId);
    return NextResponse.json(agent);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handlePATCH(
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

    if (typeof updateData.agent_name === "string") {
      const newName = updateData.agent_name.trim();
      if (!newName) {
        return NextResponse.json({ error: "The agent name cannot be empty" }, { status: 400 });
      }
      if (await nameTakenInLocation(locationId, newName, agentId)) {
        return NextResponse.json({ error: duplicateAgentMessage(newName) }, { status: 409 });
      }
      updateData.agent_name = newName;
    }

    const agent = await retell.updateAnyAgent(agentId, updateData);

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

async function handleDELETE(
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
    await retell.deleteAnyAgent(agentId);
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

export const GET = withTenantRoute(handleGET);
export const PATCH = withTenantRoute(handlePATCH);
export const DELETE = withTenantRoute(handleDELETE);
