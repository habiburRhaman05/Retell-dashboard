import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";

async function verifyOwnership(locationId: string, kbId: string) {
  const mapping = await prisma.locationKnowledgeBase.findUnique({
    where: {
      locationId_retellKnowledgeBaseId: {
        locationId,
        retellKnowledgeBaseId: kbId,
      },
    },
  });
  return !!mapping;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kbId: string; sourceId: string }> }
) {
  const { kbId, sourceId } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId");

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId is required" },
      { status: 400 }
    );
  }

  const hasAccess = await verifyOwnership(locationId, kbId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Knowledge base not found" },
      { status: 403 }
    );
  }

  try {
    const kb = await retell.deleteKnowledgeBaseSource(kbId, sourceId);
    return NextResponse.json(kb);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete source";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
