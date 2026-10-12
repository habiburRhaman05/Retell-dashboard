import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const mockQueryRaw = vi.mocked(prisma.$queryRaw);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/health", () => {
  it("returns ok when database is reachable", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
  });

  it("returns 503 when database is unreachable", async () => {
    mockQueryRaw.mockRejectedValue(new Error("Connection refused"));
    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe("error");
    expect(data.message).toContain("Database connection failed");
  });

  it("includes version in response", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    const data = await res.json();
    expect(typeof data.version).toBe("string");
  });
});
