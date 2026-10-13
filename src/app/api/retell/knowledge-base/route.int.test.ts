import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { GET, POST } from "@/app/api/retell/knowledge-base/route";
import { tenantSessionToken, liveTenant } from "@/test/auth";

const ctx = { params: Promise.resolve({}) };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationKnowledgeBase: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    location: { upsert: vi.fn(), findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

const jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(() => jar) }));

vi.mock("@/lib/retell-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/retell-api")>();
  return {
    ...actual,
    listKnowledgeBases: vi.fn(),
    createKnowledgeBase: vi.fn(),
  };
});

const findUnique = vi.mocked(prisma.location.findUnique);
const findMany = vi.mocked(prisma.locationKnowledgeBase.findMany);
const deleteMany = vi.mocked(prisma.locationKnowledgeBase.deleteMany);
const createMapping = vi.mocked(prisma.locationKnowledgeBase.create);
const upsertLocation = vi.mocked(prisma.location.upsert);
const listKnowledgeBases = vi.mocked(retell.listKnowledgeBases);
const createKnowledgeBase = vi.mocked(retell.createKnowledgeBase);

const kb = (id: string, name?: string) => ({
  knowledge_base_id: id,
  knowledge_base_name: name ?? id,
});

function listRequest(query = "locationId=loc_1") {
  return new NextRequest(`http://localhost/api/retell/knowledge-base?${query}`);
}

/** Builds the multipart body the create modal actually posts. */
function postRequest(fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new NextRequest("http://localhost/api/retell/knowledge-base", {
    method: "POST",
    body: form,
  });
}

const validCreate = () => ({
  locationId: "loc_1",
  knowledge_base_name: "FAQ",
  knowledge_base_urls: "https://example.com/faq",
});

beforeEach(() => {
  vi.clearAllMocks();
  jar.get.mockReturnValue({ value: tenantSessionToken() });
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant() as never);
  upsertLocation.mockResolvedValue({} as never);
  createMapping.mockResolvedValue({} as never);
  findUnique.mockResolvedValue({ name: "Bright AI" } as never);
});

describe("GET /api/retell/knowledge-base", () => {
  it("requires a locationId", async () => {
    const res = await GET(listRequest(""), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "locationId is required" });
    expect(listKnowledgeBases).not.toHaveBeenCalled();
  });

  it("returns [] without calling Retell when nothing is mapped", async () => {
    findMany.mockResolvedValue([] as never);

    const res = await GET(listRequest(), ctx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(listKnowledgeBases).not.toHaveBeenCalled();
  });

  it("returns only this location's knowledge bases and cleans up orphans", async () => {
    findMany.mockResolvedValue([
      { retellKnowledgeBaseId: "kb_keep" },
      { retellKnowledgeBaseId: "kb_gone" },
    ] as never);
    listKnowledgeBases.mockResolvedValue([
      kb("kb_keep", "Kept docs"),
      kb("kb_elsewhere", "Not ours"),
    ] as never);
    deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await GET(listRequest(), ctx);
    const body = await res.json();

    expect(body).toEqual([kb("kb_keep", "Kept docs")]);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { locationId: "loc_1", retellKnowledgeBaseId: { in: ["kb_gone"] } },
    });
  });

  it("returns 500 and keeps mappings when Retell fails", async () => {
    findMany.mockResolvedValue([{ retellKnowledgeBaseId: "kb1" }] as never);
    listKnowledgeBases.mockRejectedValue(new Error("Retell is down"));

    const res = await GET(listRequest(), ctx);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Retell is down" });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/retell/knowledge-base", () => {
  it("requires a locationId", async () => {
    const res = await POST(postRequest({ knowledge_base_name: "FAQ" }), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "locationId is required" });
    expect(createKnowledgeBase).not.toHaveBeenCalled();
  });

  it("requires a non-blank name", async () => {
    const res = await POST(postRequest({ locationId: "loc_1", knowledge_base_name: "   " }), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Knowledge base name is required" });
  });

  it("enforces Retell's 40 character name limit", async () => {
    const res = await POST(
      postRequest({ ...validCreate(), knowledge_base_name: "x".repeat(40) })
    , ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Knowledge base name must be less than 40 characters",
    });
    expect(createKnowledgeBase).not.toHaveBeenCalled();
  });

  it("accepts a 39 character name (the documented boundary)", async () => {
    createKnowledgeBase.mockResolvedValue(kb("kb_new") as never);

    const res = await POST(
      postRequest({ ...validCreate(), knowledge_base_name: "x".repeat(39) })
    , ctx);

    expect(res.status).toBe(201);
  });

  it("requires at least one source", async () => {
    const res = await POST(postRequest({ locationId: "loc_1", knowledge_base_name: "FAQ" }), ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one file, text entry, or URL/);
    expect(createKnowledgeBase).not.toHaveBeenCalled();
  });

  it("forwards the form without locationId, suffixing and capping the name", async () => {
    createKnowledgeBase.mockResolvedValue(kb("kb_new", "FAQ - Bright AI") as never);
    findMany.mockResolvedValue([] as never);

    const res = await POST(postRequest(validCreate()), ctx);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(kb("kb_new", "FAQ - Bright AI"));

    const forwarded = createKnowledgeBase.mock.calls[0][0];
    expect(forwarded).toBeInstanceOf(FormData);
    expect(forwarded.get("locationId")).toBeNull();
    expect(forwarded.get("knowledge_base_urls")).toBe("https://example.com/faq");
    const forwardedName = String(forwarded.get("knowledge_base_name"));
    expect(forwardedName).toBe("FAQ - Bright AI");
    expect(forwardedName.length).toBeLessThanOrEqual(39);

    expect(upsertLocation).toHaveBeenCalledWith({
      where: { locationId: "loc_1" },
      create: { locationId: "loc_1" },
      update: {},
    });
    expect(createMapping).toHaveBeenCalledWith({
      data: {
        locationId: "loc_1",
        retellKnowledgeBaseId: "kb_new",
        knowledgeBaseName: "FAQ - Bright AI",
      },
    });
  });

  it("keeps a long location suffix inside Retell's limit", async () => {
    createKnowledgeBase.mockResolvedValue(kb("kb_new") as never);
    findUnique.mockResolvedValue({ name: "The Extremely Long Location Name Ltd" } as never);

    const res = await POST(
      postRequest({ ...validCreate(), knowledge_base_name: "y".repeat(39) })
    , ctx);

    expect(res.status).toBe(201);
    const forwardedName = String(createKnowledgeBase.mock.calls[0][0].get("knowledge_base_name"));
    expect(forwardedName.length).toBeLessThanOrEqual(39);
    expect(forwardedName).toContain("…");
  });

  it("returns 500 when Retell rejects the upload", async () => {
    createKnowledgeBase.mockRejectedValue(new Error("unsupported file type"));

    const res = await POST(postRequest(validCreate()), ctx);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "unsupported file type" });
    expect(createMapping).not.toHaveBeenCalled();
  });
});

describe("access control", () => {
  it("GET returns 401 without a session and never reaches Retell", async () => {
    jar.get.mockReturnValue(undefined);
    const res = await GET(listRequest(), ctx);
    expect(res.status).toBe(401);
    expect(listKnowledgeBases).not.toHaveBeenCalled();
  });

  it("POST returns 401 without a session and creates nothing", async () => {
    jar.get.mockReturnValue(undefined);
    const res = await POST(postRequest(validCreate()), ctx);
    expect(res.status).toBe(401);
    expect(createKnowledgeBase).not.toHaveBeenCalled();
  });

  it("GET returns 403 for another tenant's location", async () => {
    const res = await GET(listRequest("locationId=loc_victim"), ctx);
    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("POST returns 403 when the multipart locationId is another tenant's, and creates nothing", async () => {
    const res = await POST(postRequest({ ...validCreate(), locationId: "loc_victim" }), ctx);
    expect(res.status).toBe(403);
    expect(createKnowledgeBase).not.toHaveBeenCalled();
    expect(createMapping).not.toHaveBeenCalled();
  });

  it("returns 403 ACCOUNT_SUSPENDED for a tenant suspended after signing in", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(liveTenant({ status: "suspended" }) as never);
    const res = await GET(listRequest(), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ACCOUNT_SUSPENDED");
  });
});
