import { NextRequest, NextResponse } from "next/server";
import { verifyRetellSignature, processCallEnded } from "@/modules/usage";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-retell-signature");
  const secret = process.env.RETELL_WEBHOOK_SECRET ?? "";

  const valid = verifyRetellSignature(rawBody, signature, secret);

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
      signatureValid: valid,
    },
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

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

    await prisma.webhookInbox.updateMany({
      where: { callId, processedAt: null },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ received: true, ...result });
  }

  return NextResponse.json({ received: true, event: eventType });
}
