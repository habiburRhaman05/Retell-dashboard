import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import { listAuditLogs } from "@/modules/audit";

export const GET = withAdmin(async (request) => {
  const url = request.nextUrl;
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const action = url.searchParams.get("action") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const logs = await listAuditLogs({ tenantId, action, limit, offset });
  return NextResponse.json(logs);
});
