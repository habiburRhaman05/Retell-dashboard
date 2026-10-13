import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const findAdmin = vi.mocked(prisma.adminUser.findUnique);

beforeEach(() => vi.clearAllMocks());

function makeRequest(body?: unknown) {
  return new NextRequest("http://localhost/api/auth/admin/company", {
    method: "POST",
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

describe("POST /api/auth/admin/company", () => {
  it("returns 400 when companyId is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed body", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 401 for an unknown companyId", async () => {
    findAdmin.mockResolvedValue(null);
    const res = await POST(makeRequest({ companyId: "does-not-exist" }));
    expect(res.status).toBe(401);
  });

  it("returns 200, sets the admin session cookie, and does not leak companyId in the response", async () => {
    findAdmin.mockResolvedValue({
      id: "a1",
      email: "admin@test.com",
      role: "owner",
      companyId: "tok_abc123",
    } as never);

    const res = await POST(makeRequest({ companyId: "tok_abc123" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.role).toBe("owner");
    expect(JSON.stringify(data)).not.toContain("tok_abc123");
    expect(mockCookies.set).toHaveBeenCalledWith(
      "admin_session",
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });
});
