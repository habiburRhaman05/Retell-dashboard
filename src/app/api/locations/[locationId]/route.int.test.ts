import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GET, PUT } from "@/app/api/locations/[locationId]/route";

// The route talks to Postgres through the shared Prisma singleton; swap only
// the storage layer so the handler's own logic is what gets exercised.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const mockedFindUnique = vi.mocked(prisma.location.findUnique);
const mockedUpsert = vi.mocked(prisma.location.upsert);

const ctx = (locationId: string) => ({ params: Promise.resolve({ locationId }) });

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/locations/loc_1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/locations/[locationId]", () => {
  it("returns the saved location name", async () => {
    mockedFindUnique.mockResolvedValue({ name: "  Bright AI Solutions  " } as never);

    const res = await GET(new NextRequest("http://localhost/api/locations/loc_1"), ctx("loc_1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locationId: "loc_1", name: "Bright AI Solutions" });
    expect(mockedFindUnique).toHaveBeenCalledWith({
      where: { locationId: "loc_1" },
      select: { name: true },
    });
  });

  it("returns null when the location is unknown or unnamed", async () => {
    mockedFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ name: "   " } as never);

    const first = await GET(new NextRequest("http://localhost/api/locations/x"), ctx("x"));
    const second = await GET(new NextRequest("http://localhost/api/locations/x"), ctx("x"));

    expect(await first.json()).toEqual({ locationId: "x", name: null });
    expect(await second.json()).toEqual({ locationId: "x", name: null });
  });

  it("stays 200 with a null name when the database is unreachable", async () => {
    mockedFindUnique.mockRejectedValue(new Error("connection refused"));

    const res = await GET(new NextRequest("http://localhost/api/locations/x"), ctx("x"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locationId: "x", name: null });
  });
});

describe("PUT /api/locations/[locationId]", () => {
  it("upserts a trimmed name", async () => {
    mockedUpsert.mockResolvedValue({ name: "Sparkle Cleaning" } as never);

    const res = await PUT(putRequest({ name: "  Sparkle Cleaning  " }), ctx("loc_1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locationId: "loc_1", name: "Sparkle Cleaning" });
    expect(mockedUpsert).toHaveBeenCalledWith({
      where: { locationId: "loc_1" },
      create: { locationId: "loc_1", name: "Sparkle Cleaning" },
      update: { name: "Sparkle Cleaning" },
      select: { name: true },
    });
  });

  it("clears the name when an empty value is sent", async () => {
    mockedUpsert.mockResolvedValue({ name: null } as never);

    const res = await PUT(putRequest({ name: "   " }), ctx("loc_1"));

    expect(res.status).toBe(200);
    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { name: null } })
    );
  });

  it("rejects names longer than 100 characters without touching the database", async () => {
    const res = await PUT(putRequest({ name: "x".repeat(101) }), ctx("loc_1"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "The name must be 100 characters or fewer" });
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("treats an unreadable body as an empty name", async () => {
    mockedUpsert.mockResolvedValue({ name: null } as never);

    const res = await PUT(putRequest("not-json{{"), ctx("loc_1"));

    expect(res.status).toBe(200);
    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { locationId: "loc_1", name: null } })
    );
  });

  it("answers 500 when the write fails", async () => {
    mockedUpsert.mockRejectedValue(new Error("unique constraint violated"));

    const res = await PUT(putRequest({ name: "Dup" }), ctx("loc_1"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "unique constraint violated" });
  });
});
