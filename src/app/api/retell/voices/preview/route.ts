import { withTenantRoute } from "@/modules/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { getVoicesCached } from "@/lib/voices-cache";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Plays a voice sample through our own origin. The browser tries the sample's
 * own link first; when that is blocked (ad blockers, strict embed policies,
 * wrong content type) it falls back to this route.
 *
 * Only the voice's own sample link is ever fetched, looked up by voice id from
 * the voice list, so this cannot be used to fetch arbitrary addresses.
 */
async function handleGET(request: NextRequest) {
  const voiceId = request.nextUrl.searchParams.get("voiceId");
  if (!voiceId) return NextResponse.json({ error: "voiceId is required" }, { status: 400 });

  try {
    const voices = await getVoicesCached();
    const url = voices.find((v) => v.voice_id === voiceId)?.preview_audio_url;
    if (!url) return NextResponse.json({ error: "No preview for this voice" }, { status: 404 });

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json({ error: `The sample could not be loaded (${upstream.status})` }, { status: 502 });
    }
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "The sample is too large" }, { status: 502 });
    }

    const path = new URL(url).pathname.toLowerCase();
    const type = path.endsWith(".wav") ? "audio/wav" : path.endsWith(".ogg") ? "audio/ogg" : "audio/mpeg";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the sample";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withTenantRoute(handleGET);
