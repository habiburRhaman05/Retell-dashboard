import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as retell from "@/lib/retell-api";
import { GET, POST } from "@/app/api/retell/knowledge-base/route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationKnowledgeBase: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    location: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

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
  upsertLocation.mockResolvedValue({} as never);
  createMapping.mockResolvedValue({} as never);
  findUnique.mockResolvedValue({ name: "Bright AI" } as never);
});

describe("GET /api/retell/knowledge-base", () => {
  it("requires a locationId", async () => {
    const res = await GET(listRequest(""));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "locationId is required" });
    expect(listKnowledgeBases).not.toHaveBeenCalled();
  });

  it("returns [] without calling Retell when nothing is mapped", async () => {
    findMany.mockResolvedValue([] as never);

    const res = await GET(listRequest());

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

    const res = await GET(listRequest());
    const body = await res.json();

    expect(body).toEqual([kb("kb_keep", "Kept docs")]);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { locationId: "loc_1", retellKnowledgeBaseId: { in: ["kb_gone"] } },
    });
  });

  it("returns 500 and keeps mappings when Retell fails", async () => {
    findMany.mockResolvedValue([{ retellKnowledgeBaseId: "kb1" }] as never);
    listKnowledgeBases.mockRejectedValue(new Error("Retell is down"));

    const res = await GET(listRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Retell is down" });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/retell/knowledge-base", () => {
  it("requires a locationId", async () => {
    const res = await POST(postRequest({ knowledge_base_name: "FAQ" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "locationId is required" });
    expect(createKnowledgeBase).not.toHaveBeenCalled();
  });

  it("requires a non-blank name", async () => {
    const res = await POST(postRequest({ locationId: "loc_1", knowledge_base_name: "   " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Knowledge base name is required" });
  });

  it("enforces Retell's 40 character name limit", async () => {
    const res = await POST(
      postRequest({ ...validCreate(), knowledge_base_name: "x".repeat(40) })
    );
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
    );

    expect(res.status).toBe(201);
  });

  it("requires at least one source", async () => {
    const res = await POST(postRequest({ locationId: "loc_1", knowledge_base_name: "FAQ" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one file, text entry, or URL/);
    expect(createKnowledgeBase).not.toHaveBeenCalled();
  });

  it("forwards the form without locationId, suffixing and capping the name", async () => {
    createKnowledgeBase.mockResolvedValue(kb("kb_new", "FAQ - Bright AI") as never);
    findMany.mockResolvedValue([] as never);

    const res = await POST(postRequest(validCreate()));

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
    );

    expect(res.status).toBe(201);
    const forwardedName = String(createKnowledgeBase.mock.calls[0][0].get("knowledge_base_name"));
    expect(forwardedName.length).toBeLessThanOrEqual(39);
    expect(forwardedName).toContain("…");
  });

  it("returns 500 when Retell rejects the upload", async () => {
    createKnowledgeBase.mockRejectedValue(new Error("unsupported file type"));

    const res = await POST(postRequest(validCreate()));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "unsupported file type" });
    expect(createMapping).not.toHaveBeenCalled();
  });
});
