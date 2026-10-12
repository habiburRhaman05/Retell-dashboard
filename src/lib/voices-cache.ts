import * as retell from "@/lib/retell-api";
import type { RetellVoice } from "@/types/retell";

// Voices change rarely; keep a short in-memory copy so opening the picker or
// playing previews repeatedly doesn't hit the voice list every time.
let cache: { at: number; voices: RetellVoice[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getVoicesCached(): Promise<RetellVoice[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.voices;
  try {
    const voices = await retell.listVoices();
    cache = { at: Date.now(), voices };
    return voices;
  } catch (error) {
    // A stale list is better than no list.
    if (cache) return cache.voices;
    throw error;
  }
}
