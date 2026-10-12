import { NextResponse } from "next/server";
import { getVoicesCached } from "@/lib/voices-cache";

export async function GET() {
  try {
    return NextResponse.json(await getVoicesCached());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load voices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
