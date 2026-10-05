import { NextRequest, NextResponse } from "next/server";
import * as retell from "@/lib/retell-api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ llmId: string }> }
) {
  const { llmId } = await params;
  try {
    const llm = await retell.getRetellLlm(llmId);
    return NextResponse.json(llm);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get LLM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ llmId: string }> }
) {
  const { llmId } = await params;
  try {
    const body = await request.json();
    const llm = await retell.updateRetellLlm(llmId, body);
    return NextResponse.json(llm);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update LLM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
