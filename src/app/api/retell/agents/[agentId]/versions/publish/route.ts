import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  try {
    const body = await request.json();
    const { locationId, version, versionTitle, versionDescription } = body;

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 }
      );
    }

    const mapping = await prisma.locationAgent.findUnique({
      where: {
        locationId_retellAgentId: {
          locationId,
          retellAgentId: agentId,
        },
      },
    });

    if (!mapping) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }

    await retell.publishAgentVersion(
      agentId,
      version,
      versionTitle,
      versionDescription
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to publish version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
