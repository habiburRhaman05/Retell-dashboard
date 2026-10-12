import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as crypto from "crypto";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const findAdmin = vi.mocked(prisma.adminUser.findUnique);

beforeEach(() => vi.clearAllMocks());

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/admin", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/admin", () => {
  it("returns 400 when email or password missing", async () => {
    const res = await POST(makeRequest({ email: "a@b.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 for unknown email", async () => {
    findAdmin.mockResolvedValue(null);
    const res = await POST(makeRequest({ email: "nobody@test.com", password: "pass" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for wrong password", async () => {
    const hash = crypto.createHash("sha256").update("correct").digest("hex");
    findAdmin.mockResolvedValue({
      id: "a1",
      email: "admin@test.com",
      role: "owner",
      passwordHash: hash,
    } as never);
    const res = await POST(makeRequest({ email: "admin@test.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 and role for valid credentials", async () => {
    const hash = crypto.createHash("sha256").update("secret").digest("hex");
    findAdmin.mockResolvedValue({
      id: "a1",
      email: "admin@test.com",
      role: "owner",
      passwordHash: hash,
    } as never);
    const res = await POST(makeRequest({ email: "admin@test.com", password: "secret" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.role).toBe("owner");
  });
});
