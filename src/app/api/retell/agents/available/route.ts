import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json(
      { error: "locationId is required" },
      { status: 400 }
    );
  }

  try {
    const allAgents = await retell.listAllAgents();
    const voiceAgents = allAgents.filter(
      (a) => (a.channel === "voice" || a.channel === "chat") && !retell.isHiddenTestChatAgent(a)
    );

    const allMappings = await prisma.locationAgent.findMany({
      select: { retellAgentId: true },
    });
    const mappedIds = new Set(allMappings.map((m) => m.retellAgentId));

    const available = voiceAgents.filter((a) => !mappedIds.has(a.agent_id));

    return NextResponse.json(available);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list available agents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
