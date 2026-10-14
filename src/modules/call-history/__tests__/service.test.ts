import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { locationAgent: { findMany: vi.fn() } },
}));

vi.mock("@/lib/retell-api", () => ({
  listCalls: vi.fn(),
  getCall: vi.fn(),
  fetchPublicLog: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { listCallsForTenant, getCallForTenant, CallNotFoundError } from "../service";
import type { ListCallsQuery } from "../schemas";

const findMany = vi.mocked(prisma.locationAgent.findMany);
const listCalls = vi.mocked(retell.listCalls);
const getCall = vi.mocked(retell.getCall);
const fetchPublicLog = vi.mocked(retell.fetchPublicLog);

const baseQuery: ListCallsQuery = { page: 1, pageSize: 50 };

beforeEach(() => vi.clearAllMocks());

describe("listCallsForTenant", () => {
  it("returns an empty page without calling Retell when the tenant has no agents", async () => {
    findMany.mockResolvedValue([] as never);
    const page = await listCallsForTenant("loc_1", baseQuery);
    expect(page).toEqual({ items: [], page: 1, pageSize: 50, total: 0, hasMore: false });
    expect(listCalls).not.toHaveBeenCalled();
  });

  it("scopes the Retell filter to the tenant's own agent ids", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }, { retellAgentId: "a2" }] as never);
    listCalls.mockResolvedValue({ items: [], has_more: false, pagination_key: null, total: 0 });

    await listCallsForTenant("loc_1", baseQuery);

    expect(listCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        filter_criteria: expect.objectContaining({
          agent: [{ agent_id: "a1" }, { agent_id: "a2" }],
        }),
      })
    );
  });

  it("applies optional filters and date range", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    listCalls.mockResolvedValue({ items: [], has_more: false, pagination_key: null });

    await listCallsForTenant("loc_1", {
      ...baseQuery,
      start: 100,
      end: 200,
      status: "ended",
      direction: "inbound",
      sentiment: "Positive",
      disconnectionReason: "user_hangup",
      callSuccessful: true,
    });

    expect(listCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        filter_criteria: expect.objectContaining({
          start_timestamp: { type: "range", op: "bt", value: [100, 200] },
          call_status: ["ended"],
          direction: ["inbound"],
          user_sentiment: ["Positive"],
          disconnection_reason: ["user_hangup"],
          call_successful: true,
        }),
      })
    );
  });

  it("maps page/pageSize to skip/limit and passes through total/hasMore", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    listCalls.mockResolvedValue({
      items: [{ call_id: "c1" } as never],
      has_more: true,
      pagination_key: "next",
      total: 54,
    });

    const page = await listCallsForTenant("loc_1", { ...baseQuery, page: 2, pageSize: 10 });

    expect(listCalls).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, skip: 10 }));
    expect(page).toEqual({
      items: [{ call_id: "c1" }],
      page: 2,
      pageSize: 10,
      total: 54,
      hasMore: true,
    });
  });
});

describe("getCallForTenant", () => {
  it("throws CallNotFoundError when the tenant has no agents", async () => {
    findMany.mockResolvedValue([] as never);
    await expect(getCallForTenant("loc_1", "call_1")).rejects.toThrow(CallNotFoundError);
    expect(getCall).not.toHaveBeenCalled();
  });

  it("throws CallNotFoundError when Retell has no such call", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    getCall.mockRejectedValue(new Error("404"));
    await expect(getCallForTenant("loc_1", "call_1")).rejects.toThrow(CallNotFoundError);
  });

  it("throws CallNotFoundError when the call belongs to another tenant's agent", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    getCall.mockResolvedValue({ call_id: "call_1", agent_id: "someone_elses_agent" } as never);
    await expect(getCallForTenant("loc_1", "call_1")).rejects.toThrow(CallNotFoundError);
  });

  it("returns the call and parsed log lines for an owned call", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    getCall.mockResolvedValue({
      call_id: "call_1",
      agent_id: "a1",
      public_log_url: "https://logs.example/call_1.log",
    } as never);
    fetchPublicLog.mockResolvedValue("line one\nline two\n\n");

    const detail = await getCallForTenant("loc_1", "call_1");

    expect(detail.call.call_id).toBe("call_1");
    expect(detail.logLines).toEqual(["line one", "line two"]);
  });

  it("still returns the call when fetching logs fails", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    getCall.mockResolvedValue({
      call_id: "call_1",
      agent_id: "a1",
      public_log_url: "https://logs.example/call_1.log",
    } as never);
    fetchPublicLog.mockRejectedValue(new Error("network error"));

    const detail = await getCallForTenant("loc_1", "call_1");
    expect(detail.call.call_id).toBe("call_1");
    expect(detail.logLines).toEqual([]);
  });

  it("returns no log lines when the call has no public_log_url", async () => {
    findMany.mockResolvedValue([{ retellAgentId: "a1" }] as never);
    getCall.mockResolvedValue({ call_id: "call_1", agent_id: "a1" } as never);

    const detail = await getCallForTenant("loc_1", "call_1");
    expect(detail.logLines).toEqual([]);
    expect(fetchPublicLog).not.toHaveBeenCalled();
  });
});
