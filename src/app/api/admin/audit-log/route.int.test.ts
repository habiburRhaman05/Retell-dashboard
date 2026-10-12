import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { findMany: vi.fn() },
  },
}));

const mockCookies = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookies),
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const findMany = vi.mocked(prisma.auditLog.findMany);

function ownerSession() {
  return Buffer.from(JSON.stringify({
    adminId: "a1", email: "admin@test.com", role: "owner",
  })).toString("base64");
}

function supportSession() {
  return Buffer.from(JSON.stringify({
    adminId: "a2", email: "support@test.com", role: "support",
  })).toString("base64");
}

const context = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/audit-log", () => {
  it("returns 401 without admin session", async () => {
    mockCookies.get.mockReturnValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/audit-log");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("returns audit logs for owner", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findMany.mockResolvedValue([
      { id: "l1", action: "tenant.create" },
    ] as never);
    const req = new NextRequest("http://localhost/api/admin/audit-log");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
  });

  it("allows support role to view", async () => {
    mockCookies.get.mockReturnValue({ value: supportSession() });
    findMany.mockResolvedValue([] as never);
    const req = new NextRequest("http://localhost/api/admin/audit-log");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
  });

  it("passes tenantId filter", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findMany.mockResolvedValue([] as never);
    const req = new NextRequest("http://localhost/api/admin/audit-log?tenantId=t1");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
  });

  it("passes action filter", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findMany.mockResolvedValue([] as never);
    const req = new NextRequest("http://localhost/api/admin/audit-log?action=tenant.create");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: "tenant.create" }),
      })
    );
  });

  it("caps limit at 200", async () => {
    mockCookies.get.mockReturnValue({ value: ownerSession() });
    findMany.mockResolvedValue([] as never);
    const req = new NextRequest("http://localhost/api/admin/audit-log?limit=999");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });
});
