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
    const { locationId, chatId, content } = body as {
      locationId?: string;
      chatId?: string;
      content?: string;
    };

    if (!locationId || !chatId || !content?.trim()) {
      return NextResponse.json(
        { error: "locationId, chatId and content are required" },
        { status: 400 }
      );
    }

    const mapping = await prisma.locationAgent.findUnique({
      where: { locationId_retellAgentId: { locationId, retellAgentId: agentId } },
    });
    if (!mapping) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }

    const result = await retell.createChatCompletion(chatId, content.trim());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get a reply";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
