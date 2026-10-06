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
    const allKbs = await retell.listKnowledgeBases();

    const mapped = await prisma.locationKnowledgeBase.findMany({
      select: { retellKnowledgeBaseId: true },
    });
    const mappedIds = new Set(mapped.map((m) => m.retellKnowledgeBaseId));

    const available = allKbs.filter(
      (kb) => !mappedIds.has(kb.knowledge_base_id)
    );

    return NextResponse.json(available);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list available knowledge bases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
