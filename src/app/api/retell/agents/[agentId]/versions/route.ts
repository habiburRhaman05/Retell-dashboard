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
    const versions = await retell.listAgentVersions(agentId);
    return NextResponse.json(versions);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list versions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  try {
    const body = await request.json();
    const { locationId, baseVersion } = body;

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

    const draft = await retell.createDraftVersion(agentId, baseVersion);
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
