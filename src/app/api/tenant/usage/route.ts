import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/modules/auth/middleware";
import { getUsageSummary, getUsageCounters } from "@/modules/usage";

export const GET = withTenant(async (request: NextRequest, session) => {
  const url = request.nextUrl;
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startDate = url.searchParams.get("start")
    ? new Date(url.searchParams.get("start")!)
    : defaultStart;
  const endDate = url.searchParams.get("end")
    ? new Date(url.searchParams.get("end")!)
    : now;

  const [summary, counters] = await Promise.all([
    getUsageSummary(session.tenantId, startDate, endDate),
    getUsageCounters(session.tenantId),
  ]);

  return NextResponse.json({ summary, counters });
});
