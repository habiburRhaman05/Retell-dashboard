import { NextResponse } from "next/server";
import * as retell from "@/lib/retell-api";

// Cheap authenticated call that tells the settings page whether the server's
// Retell API key works, and how fast Retell answers.
export async function GET() {
  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({
      connected: false,
      error: "RETELL_API_KEY is not set on the server.",
    });
  }
  const started = Date.now();
  try {
    await retell.listVoices();
    return NextResponse.json({ connected: true, latencyMs: Date.now() - started });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach Retell";
    const unauthorized = /\b401\b/.test(message);
    return NextResponse.json({
      connected: false,
      error: unauthorized ? "Retell rejected the API key (401). Check RETELL_API_KEY." : message,
    });
  }
}
