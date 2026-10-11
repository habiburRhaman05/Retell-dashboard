import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocationName } from "@/lib/location-name";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  const { locationId } = await params;
  try {
    return NextResponse.json({ locationId, name: await getLocationName(locationId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load the location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  const { locationId } = await params;
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length > 100) {
      return NextResponse.json({ error: "The name must be 100 characters or fewer" }, { status: 400 });
    }
    const saved = await prisma.location.upsert({
      where: { locationId },
      create: { locationId, name: name || null },
      update: { name: name || null },
      select: { name: true },
    });
    return NextResponse.json({ locationId, name: saved.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save the name";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
