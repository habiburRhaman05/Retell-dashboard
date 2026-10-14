import * as retell from "@/lib/retell-api";
import type { ListCallsFilterCriteria, RetellCall } from "@/types/retell";
import { listAgentIdsForLocation } from "./repository";
import type { ListCallsQuery } from "./schemas";

export interface CallHistoryPage {
  items: RetellCall[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
}

/**
 * The tenant's own calls, scoped by resolving their Retell agent ids from
 * our DB first - never by trusting anything in the query beyond locationId
 * (which withTenantRoute already verified against the session).
 */
export async function listCallsForTenant(
  locationId: string,
  query: ListCallsQuery
): Promise<CallHistoryPage> {
  const agentIds = await listAgentIdsForLocation(locationId);
  if (agentIds.length === 0) {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, hasMore: false };
  }

  const filterCriteria: ListCallsFilterCriteria = {
    agent: agentIds.map((agent_id) => ({ agent_id })),
  };
  if (query.start !== undefined || query.end !== undefined) {
    filterCriteria.start_timestamp = {
      type: "range",
      op: "bt",
      value: [query.start ?? 0, query.end ?? Date.now()],
    };
  }
  if (query.status) filterCriteria.call_status = [query.status];
  if (query.direction) filterCriteria.direction = [query.direction];
  if (query.sentiment) filterCriteria.user_sentiment = [query.sentiment];
  if (query.disconnectionReason) filterCriteria.disconnection_reason = [query.disconnectionReason];
  if (query.callSuccessful !== undefined) filterCriteria.call_successful = query.callSuccessful;

  const res = await retell.listCalls({
    filter_criteria: filterCriteria,
    sort_order: "descending",
    limit: query.pageSize,
    skip: (query.page - 1) * query.pageSize,
    include_total: true,
  });

  return {
    items: res.items,
    page: query.page,
    pageSize: query.pageSize,
    total: res.total ?? null,
    hasMore: res.has_more,
  };
}

// Deliberately 403-shaped, not 404: whether a call_id belongs to someone
// else or doesn't exist at all is not information a tenant should be able
// to distinguish (mirrors the existing retell/agents/[agentId] convention).
export class CallNotFoundError extends Error {
  constructor() {
    super("Call not found");
    this.name = "CallNotFoundError";
  }
}

export interface CallDetail {
  call: RetellCall;
  logLines: string[];
}

/** One call's full detail (transcript, recording, analysis), verifying it belongs to this tenant. */
export async function getCallForTenant(locationId: string, callId: string): Promise<CallDetail> {
  const agentIds = await listAgentIdsForLocation(locationId);
  if (agentIds.length === 0) throw new CallNotFoundError();

  let call: RetellCall;
  try {
    call = await retell.getCall(callId);
  } catch {
    throw new CallNotFoundError();
  }

  if (!agentIds.includes(call.agent_id)) {
    throw new CallNotFoundError();
  }

  let logLines: string[] = [];
  if (call.public_log_url) {
    try {
      const text = await retell.fetchPublicLog(call.public_log_url);
      logLines = text.split("\n").filter((line) => line.length > 0);
    } catch {
      // Detail logs are a nice-to-have; the rest of the call detail still works.
    }
  }

  return { call, logLines };
}
