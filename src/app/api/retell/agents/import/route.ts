import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, agentIds } = body as {
      locationId: string;
      agentIds: string[];
    };

    if (!locationId || !agentIds?.length) {
      return NextResponse.json(
        { error: "locationId and agentIds are required" },
        { status: 400 }
      );
    }

    const allAgents = await retell.listAllAgents();
    const agentMap = new Map(allAgents.map((a) => [a.agent_id, a]));

    const alreadyMapped = await prisma.locationAgent.findMany({
      where: { retellAgentId: { in: agentIds } },
      select: { retellAgentId: true, locationId: true },
    });
    const alreadyMappedIds = new Set(alreadyMapped.map((m) => m.retellAgentId));

    const toImport = agentIds.filter(
      (id) => agentMap.has(id) && !alreadyMappedIds.has(id)
    );

    if (toImport.length === 0) {
      return NextResponse.json(
        { error: "No valid agents to import. They may already be assigned to a location." },
        { status: 400 }
      );
    }

    await prisma.location.upsert({
      where: { locationId },
      create: { locationId },
      update: {},
    });

    await prisma.locationAgent.createMany({
      data: toImport.map((id) => ({
        locationId,
        retellAgentId: id,
        agentName: agentMap.get(id)?.agent_name || null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      imported: toImport.length,
      agentIds: toImport,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import agents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
