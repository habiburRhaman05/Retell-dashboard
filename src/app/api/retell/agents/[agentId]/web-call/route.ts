import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { locationId } = body as { locationId?: string };

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 }
      );
    }

    const mapping = await prisma.locationAgent.findUnique({
      where: {
        locationId_retellAgentId: { locationId, retellAgentId: agentId },
      },
    });

    if (!mapping) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }

    const webCall = await retell.createWebCall(agentId);
    return NextResponse.json(webCall, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start test call";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
