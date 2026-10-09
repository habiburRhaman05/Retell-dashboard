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
    const { locationId, dynamicVariables } = body as {
      locationId?: string;
      dynamicVariables?: Record<string, string>;
    };

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    const mapping = await prisma.locationAgent.findUnique({
      where: { locationId_retellAgentId: { locationId, retellAgentId: agentId } },
    });
    if (!mapping) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }

    const chat = await retell.createChat(agentId, dynamicVariables);
    return NextResponse.json(chat, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start chat";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
