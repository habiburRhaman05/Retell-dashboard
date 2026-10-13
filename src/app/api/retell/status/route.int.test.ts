import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { tenant: { findUnique: vi.fn() } },
}));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(() => jar) }));

import { prisma } from "@/lib/prisma";
import { tenantSessionToken, liveTenant } from "@/test/auth";
import { GET } from "@/app/api/retell/status/route";

const ctx = { params: Promise.resolve({}) };
const statusRequest = () => new NextRequest("http://localhost/api/retell/status");

// Integration-level: the real retell-api module runs, only the network is faked.
const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const originalKey = process.env.RETELL_API_KEY;

beforeEach(() => {
  jar.get.mockReturnValue({ value: tenantSessionToken() });
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.RETELL_API_KEY = "key_test_123";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.RETELL_API_KEY;
  else process.env.RETELL_API_KEY = originalKey;
});

describe("GET /api/retell/status", () => {
  it("reports connected with latency when Retell answers", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [{ voice_id: "v1" }]));

    const res = await GET(statusRequest(), ctx);
    const body = await res.json();

    expect(body.connected).toBe(true);
    expect(typeof body.latencyMs).toBe("number");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.retellai.com/list-voices",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer key_test_123",
        }),
      })
    );
  });

  it("reports disconnected when the API key is missing", async () => {
    delete process.env.RETELL_API_KEY;

    const body = await (await GET(statusRequest(), ctx)).json();

    expect(body.connected).toBe(false);
    expect(body.error).toMatch(/RETELL_API_KEY is not set/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 401s with guidance about the API key", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { message: "Invalid API key" })
    );

    const body = await (await GET(statusRequest(), ctx)).json();

    expect(body.connected).toBe(false);
    expect(body.error).toMatch(/401/);
    expect(body.error).toMatch(/RETELL_API_KEY/);
  });

  it("surfaces Retell's own message for other failures", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, { message: "Voices are unavailable" })
    );

    const body = await (await GET(statusRequest(), ctx)).json();

    expect(body.connected).toBe(false);
    expect(body.error).toBe("Voices are unavailable");
  });

  it("reports the thrown message when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));

    const body = await (await GET(statusRequest(), ctx)).json();

    expect(body.connected).toBe(false);
    expect(body.error).toBe("fetch failed");
  });
});

describe("access control", () => {
  it("returns 401 without a session and never calls Retell", async () => {
    jar.get.mockReturnValue(undefined);
    const res = await GET(statusRequest(), ctx);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 for a suspended tenant", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant({ status: "suspended" }) as never);
    const res = await GET(statusRequest(), ctx);
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
