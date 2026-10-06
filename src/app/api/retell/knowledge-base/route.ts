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
    const mappings = await prisma.locationKnowledgeBase.findMany({
      where: { locationId },
      select: { retellKnowledgeBaseId: true },
    });

    if (mappings.length === 0) {
      return NextResponse.json([]);
    }

    const allKbs = await retell.listKnowledgeBases();
    const kbIds = new Set(mappings.map((m) => m.retellKnowledgeBaseId));
    const locationKbs = allKbs.filter((kb) => kbIds.has(kb.knowledge_base_id));

    // Clean up mappings pointing at knowledge bases that no longer exist upstream.
    const foundIds = new Set(locationKbs.map((kb) => kb.knowledge_base_id));
    const orphanIds = [...kbIds].filter((id) => !foundIds.has(id));
    if (orphanIds.length > 0) {
      await prisma.locationKnowledgeBase.deleteMany({
        where: { locationId, retellKnowledgeBaseId: { in: orphanIds } },
      });
    }

    return NextResponse.json(locationKbs);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list knowledge bases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();
    const locationId = incoming.get("locationId");

    if (!locationId || typeof locationId !== "string") {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 }
      );
    }

    const name = incoming.get("knowledge_base_name");
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Knowledge base name is required" },
        { status: 400 }
      );
    }
    if (name.length >= 40) {
      return NextResponse.json(
        { error: "Knowledge base name must be less than 40 characters" },
        { status: 400 }
      );
    }

    const hasSource =
      incoming.has("knowledge_base_files") ||
      incoming.has("knowledge_base_texts") ||
      incoming.has("knowledge_base_urls");
    if (!hasSource) {
      return NextResponse.json(
        {
          error:
            "Add at least one file, text entry, or URL — Retell requires a knowledge base to have a starting source",
        },
        { status: 400 }
      );
    }

    // Forward everything except our internal locationId field to Retell.
    const forward = new FormData();
    for (const [key, value] of incoming.entries()) {
      if (key === "locationId") continue;
      forward.append(key, value);
    }

    const kb = await retell.createKnowledgeBase(forward);

    await prisma.location.upsert({
      where: { locationId },
      create: { locationId },
      update: {},
    });

    await prisma.locationKnowledgeBase.create({
      data: {
        locationId,
        retellKnowledgeBaseId: kb.knowledge_base_id,
        knowledgeBaseName: kb.knowledge_base_name,
      },
    });

    return NextResponse.json(kb, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create knowledge base";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
