import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { withTenantRoute } from "@/modules/auth/middleware";
import type { TenantSession } from "@/modules/auth";

type Ctx = { params: Promise<{ llmId: string }> };

// An LLM may only be reached through one of the signed-in tenant's own agents:
// the caller names the agent, the agent must be mapped to this tenant, and the
// LLM must be that agent's own response engine. Otherwise any tenant could read
// or rewrite any prompt in the shared Retell account.
async function ownLlm(
  request: NextRequest,
  llmId: string,
  session: TenantSession
): Promise<NextResponse | null> {
  const agentId = request.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  const mapping = await prisma.locationAgent.findUnique({
    where: { locationId_retellAgentId: { locationId: session.crmLocationId, retellAgentId: agentId } },
  });
  if (!mapping) {
    return NextResponse.json({ error: "Agent not found" }, { status: 403 });
  }
  const agent = await retell.getAnyAgent(agentId);
  if (agent.response_engine?.llm_id !== llmId) {
    return NextResponse.json({ error: "LLM not found" }, { status: 403 });
  }
  return null;
}

async function handleGET(request: NextRequest, { params }: Ctx, session: TenantSession) {
  const { llmId } = await params;
  try {
    const denied = await ownLlm(request, llmId, session);
    if (denied) return denied;
    const llm = await retell.getRetellLlm(llmId);
    return NextResponse.json(llm);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get LLM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handlePATCH(request: NextRequest, { params }: Ctx, session: TenantSession) {
  const { llmId } = await params;
  try {
    const denied = await ownLlm(request, llmId, session);
    if (denied) return denied;
    const body = await request.json();
    const llm = await retell.updateRetellLlm(llmId, body);
    return NextResponse.json(llm);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update LLM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withTenantRoute(handleGET);
export const PATCH = withTenantRoute(handlePATCH);
