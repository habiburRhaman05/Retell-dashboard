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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kbId: string }> }
) {
  const { kbId } = await params;
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
    const kb = await retell.getKnowledgeBase(kbId);
    return NextResponse.json(kb);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch knowledge base";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kbId: string }> }
) {
  const { kbId } = await params;
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
    await retell.deleteKnowledgeBase(kbId);
    await prisma.locationKnowledgeBase.deleteMany({
      where: { locationId, retellKnowledgeBaseId: kbId },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete knowledge base";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
