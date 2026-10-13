import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookInbox: { create: vi.fn(), updateMany: vi.fn() },
    usageEvent: { findUnique: vi.fn(), create: vi.fn() },
    usageCounter: { upsert: vi.fn() },
    locationAgent: { findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const createInbox = vi.mocked(prisma.webhookInbox.create);
const updateInbox = vi.mocked(prisma.webhookInbox.updateMany);
const findEvent = vi.mocked(prisma.usageEvent.findUnique);
const findAgent = vi.mocked(prisma.locationAgent.findFirst);
const findTenant = vi.mocked(prisma.tenant.findUnique);
const transaction = vi.mocked(prisma.$transaction);

const API_KEY = "key_test_webhook_123";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RETELL_API_KEY = API_KEY;
  createInbox.mockResolvedValue({ id: "inbox_1" } as never);
  updateInbox.mockResolvedValue({ count: 1 } as never);
});

// Retell's format: v={timestamp_ms},d=HMAC-SHA256(body + timestamp, apiKey)
function sign(body: string, ts = Date.now(), key = API_KEY) {
  const digest = createHmac("sha256", key).update(body + String(ts)).digest("hex");
  return `v=${ts},d=${digest}`;
}

function makeRequest(body: string, signature?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature !== null && signature !== undefined) {
    headers["x-retell-signature"] = signature;
  }
  return new NextRequest("http://localhost/api/webhooks/retell", {
    method: "POST",
    body,
    headers,
  });
}

describe("POST /api/webhooks/retell", () => {
  it("rejects an invalid signature with 401 and writes nothing", async () => {
    const body = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });
    const res = await POST(makeRequest(body, "wrong-sig"));
    expect(res.status).toBe(401);
    expect(createInbox).not.toHaveBeenCalled();
  });

  it("logs why a webhook was rejected, never the key or the signature", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });

    await POST(makeRequest(body, sign(body, Date.now(), "key_someone_else")));

    expect(warn).toHaveBeenCalledWith("[retell-webhook] rejected", {
      ok: false,
      reason: "digest_mismatch",
      bodyBytes: body.length,
    });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain("key_someone_else");
    warn.mockRestore();
  });

  it("rejects a missing signature with 401", async () => {
    const body = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });
    const res = await POST(makeRequest(body, null));
    expect(res.status).toBe(401);
    expect(createInbox).not.toHaveBeenCalled();
  });

  it("rejects a signature made with the wrong key", async () => {
    const body = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });
    const res = await POST(makeRequest(body, sign(body, Date.now(), "key_someone_else")));
    expect(res.status).toBe(401);
  });

  it("rejects a replayed webhook with an old timestamp", async () => {
    const body = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });
    const res = await POST(makeRequest(body, sign(body, Date.now() - 10 * 60 * 1000)));
    expect(res.status).toBe(401);
  });

  it("rejects everything when the API key is not configured", async () => {
    process.env.RETELL_API_KEY = " ";
    const body = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });
    const res = await POST(makeRequest(body, sign(body, Date.now(), " ")));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const body = "not valid json";
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it("stores all signed events in the webhook inbox", async () => {
    const body = JSON.stringify({ event: "call_started", call: { call_id: "c1" } });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(createInbox).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "call_started",
          signatureValid: true,
        }),
      })
    );
  });

  it("processes call_ended event with valid signature", async () => {
    findEvent.mockResolvedValue(null);
    findAgent.mockResolvedValue({ locationId: "loc_1" } as never);
    findTenant.mockResolvedValue({ id: "t1" } as never);
    transaction.mockImplementation(async (fn) => {
      const tx = {
        usageEvent: {
          create: vi.fn().mockResolvedValue({ id: "e1", callId: "c1" }),
        },
        usageCounter: { upsert: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx as never);
    });

    const payload = {
      event: "call_ended",
      call: {
        call_id: "c1",
        agent_id: "agent_1",
        call_status: "ended",
        start_timestamp: 1696100000000,
        end_timestamp: 1696100300000,
        duration_ms: 300000,
      },
    };
    const body = JSON.stringify(payload);
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("processed");
  });

  it("handles duplicate call_id idempotently", async () => {
    findEvent.mockResolvedValue({ id: "existing" } as never);
    const payload = {
      event: "call_ended",
      call: { call_id: "dup_1", agent_id: "agent_1", call_status: "ended" },
    };
    const body = JSON.stringify(payload);
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("duplicate");
  });

  it("dead-letters unknown agent_id", async () => {
    findEvent.mockResolvedValue(null);
    findAgent.mockResolvedValue(null);
    const payload = {
      event: "call_ended",
      call: { call_id: "c2", agent_id: "unknown_agent", call_status: "ended" },
    };
    const body = JSON.stringify(payload);
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("dead_letter");
  });

  it("returns 200 for non-call events", async () => {
    const body = JSON.stringify({ event: "call_started" });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event).toBe("call_started");
  });
});
