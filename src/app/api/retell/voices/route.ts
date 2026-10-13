import { withTenantRoute } from "@/modules/auth/middleware";
import { NextResponse } from "next/server";
import { getVoicesCached } from "@/lib/voices-cache";

async function handleGET() {
  try {
    return NextResponse.json(await getVoicesCached());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load voices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withTenantRoute(handleGET);
