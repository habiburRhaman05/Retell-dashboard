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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ kbId: string }> }
) {
  const { kbId } = await params;

  try {
    const incoming = await request.formData();
    const locationId = incoming.get("locationId");

    if (!locationId || typeof locationId !== "string") {
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

    const forward = new FormData();
    let hasSource = false;
    for (const [key, value] of incoming.entries()) {
      if (key === "locationId") continue;
      if (
        key === "knowledge_base_files" ||
        key === "knowledge_base_texts" ||
        key === "knowledge_base_urls"
      ) {
        hasSource = true;
      }
      forward.append(key, value);
    }

    if (!hasSource) {
      return NextResponse.json(
        { error: "Add at least one file, text, or URL source" },
        { status: 400 }
      );
    }

    const kb = await retell.addKnowledgeBaseSources(kbId, forward);

    await prisma.locationKnowledgeBase.updateMany({
      where: { locationId, retellKnowledgeBaseId: kbId },
      data: { knowledgeBaseName: kb.knowledge_base_name },
    });

    return NextResponse.json(kb, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add sources";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
