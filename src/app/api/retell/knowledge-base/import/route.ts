import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, knowledgeBaseIds } = body as {
      locationId: string;
      knowledgeBaseIds: string[];
    };

    if (!locationId || !knowledgeBaseIds?.length) {
      return NextResponse.json(
        { error: "locationId and knowledgeBaseIds are required" },
        { status: 400 }
      );
    }

    const allKbs = await retell.listKnowledgeBases();
    const kbMap = new Map(allKbs.map((kb) => [kb.knowledge_base_id, kb]));

    const alreadyMapped = await prisma.locationKnowledgeBase.findMany({
      where: { retellKnowledgeBaseId: { in: knowledgeBaseIds } },
      select: { retellKnowledgeBaseId: true },
    });
    const alreadyMappedIds = new Set(
      alreadyMapped.map((m) => m.retellKnowledgeBaseId)
    );

    const toImport = knowledgeBaseIds.filter(
      (id) => kbMap.has(id) && !alreadyMappedIds.has(id)
    );

    if (toImport.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid knowledge bases to import. They may already be assigned to a location.",
        },
        { status: 400 }
      );
    }

    await prisma.location.upsert({
      where: { locationId },
      create: { locationId },
      update: {},
    });

    await prisma.locationKnowledgeBase.createMany({
      data: toImport.map((id) => ({
        locationId,
        retellKnowledgeBaseId: id,
        knowledgeBaseName: kbMap.get(id)?.knowledge_base_name || null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      imported: toImport.length,
      knowledgeBaseIds: toImport,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to import knowledge bases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
