import { NextRequest, NextResponse } from "next/server";
import { checkRetellSignature } from "@/modules/usage/webhook";
import { processCallEnded } from "@/modules/usage";
import { prisma } from "@/lib/prisma";
import { reconcileCallLimitForTenant } from "@/modules/call-limits";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-retell-signature");

  // Retell signs with the API key that carries the webhook badge. That is
  // RETELL_API_KEY unless RETELL_WEBHOOK_KEY names a different badged key.
  // Check before touching the database so unsigned requests cannot write anything.
  const signingKey = process.env.RETELL_WEBHOOK_KEY?.trim() || process.env.RETELL_API_KEY || "";
  const check = checkRetellSignature(rawBody, signature, signingKey);
  if (!check.ok) {
    // Visible in the host's logs so a 401 can be diagnosed. Never log the key or the signature.
    console.warn("[retell-webhook] rejected", { ...check, bodyBytes: rawBody.length });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: { event?: string; call?: Record<string, unknown>; call_id?: string; [k: string]: unknown };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = String(parsed.event ?? "unknown");
  const callId = String(parsed.call?.call_id ?? parsed.call_id ?? "");

  await prisma.webhookInbox.create({
    data: {
      eventType,
      callId: callId || null,
      rawBody,
      signatureValid: true,
    },
  });

  if (eventType === "call_ended" || eventType === "call_analyzed") {
    const callData = (parsed.call ?? parsed) as Record<string, unknown>;
    const result = await processCallEnded({
      call_id: String(callData.call_id ?? callId),
      agent_id: String(callData.agent_id ?? ""),
      call_status: String(callData.call_status ?? "ended"),
      start_timestamp: callData.start_timestamp as number | undefined,
      end_timestamp: callData.end_timestamp as number | undefined,
      duration_ms: callData.duration_ms as number | undefined,
      call_cost: callData.call_cost as { combined_cost?: number } | undefined,
    });

    if (result.status === "processed") {
      const mapping = await prisma.locationAgent.findFirst({
        where: { retellAgentId: String(callData.agent_id ?? "") },
        select: { locationId: true },
      });
      const tenant = mapping
        ? await prisma.tenant.findUnique({
            where: { crmLocationId: mapping.locationId },
            select: { id: true },
          })
        : null;
      if (tenant) {
        try {
          await reconcileCallLimitForTenant(tenant.id);
        } catch (error) {
          // The usage event is durable and the scheduled reconciler retries;
          // a Retell routing outage must not cause repeated webhook delivery.
          console.error("[retell-webhook] call limit reconciliation failed", {
            tenantId: tenant.id,
            callId,
            error: error instanceof Error ? error.message : "unknown error",
          });
        }
      }
    }

    await prisma.webhookInbox.updateMany({
      where: { callId, processedAt: null },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ received: true, ...result });
  }

  return NextResponse.json({ received: true, event: eventType });
}
