import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { reconcileAllCallLimits } from "@/modules/call-limits";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const configured = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !supplied) return false;
  const expectedBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await reconcileAllCallLimits();
  const tenantsWithErrors = results.tenants.filter((item) => item.error).length;
  const routingErrors = results.routing?.errors.length ?? (results.routingError ? 1 : 0);
  const failed = tenantsWithErrors + routingErrors;
  return NextResponse.json(
    {
      tenantsChecked: results.tenants.length,
      tenantsWithErrors,
      routingErrors,
      // Keep phone numbers and Retell error bodies out of the public response.
    },
    { status: failed ? 503 : 200 }
  );
}
