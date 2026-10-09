import { NextResponse } from "next/server";
import * as retell from "@/lib/retell-api";
import type { RetellVoice } from "@/types/retell";

// Voices change rarely; keep a short in-memory copy so opening the picker
// repeatedly doesn't hit Retell every time. Retell stays the source of truth.
let cache: { at: number; voices: RetellVoice[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return NextResponse.json(cache.voices);
    }
    const voices = await retell.listVoices();
    cache = { at: Date.now(), voices };
    return NextResponse.json(voices);
  } catch (error) {
    if (cache) return NextResponse.json(cache.voices);
    const message = error instanceof Error ? error.message : "Failed to load voices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
