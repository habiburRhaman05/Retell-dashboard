import { withTenantRoute } from "@/modules/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { checkAccess } from "@/modules/enforcement";

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { locationId } = body as { locationId?: string };

    if (!locationId) {
      return NextResponse.json(
        { error: "locationId is required" },
        { status: 400 }
      );
    }

    const mapping = await prisma.locationAgent.findUnique({
      where: {
        locationId_retellAgentId: { locationId, retellAgentId: agentId },
      },
    });

    if (!mapping) {
      return NextResponse.json({ error: "Agent not found" }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { crmLocationId: locationId },
      select: { id: true },
    });
    if (tenant) {
      const access = await checkAccess(tenant.id, "calls.make", "CALL_MINUTES");
      if (!access.allowed) {
        return NextResponse.json(
          { error: access.reason, code: access.code },
          { status: 403 }
        );
      }
    }

    const webCall = await retell.createWebCall(agentId);
    return NextResponse.json(webCall, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start test call";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withTenantRoute(handlePOST);
