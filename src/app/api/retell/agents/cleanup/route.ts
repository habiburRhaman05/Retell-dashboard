import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  try {
    const result = await prisma.locationAgent.deleteMany({});
    return NextResponse.json({
      message: `Cleared ${result.count} agent mappings. Use Import to reassign agents to locations.`,
      deleted: result.count,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cleanup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
