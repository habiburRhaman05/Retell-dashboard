import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RetellApiError,
  createAgent,
  createKnowledgeBase,
  deleteAgent,
  deleteTestChatAgents,
  getAnyAgent,
  getOrCreateTestChatAgent,
  isHiddenTestChatAgent,
  listAgents,
  listAllAgents,
  listTestRuns,
  updateAnyAgent,
} from "./retell-api";

// All network access is stubbed; the module's own logic (headers, error
// mapping, channel fallback, test-chat agent lifecycle) is what runs for real.
const fetchMock = vi.fn();

const originalKey = process.env.RETELL_API_KEY;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Answers with a canned payload for one path, 404s for everything else. */
function reply(path: string, body: unknown, status = 200) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes(path)) return jsonResponse(status, body);
    return jsonResponse(404, { message: `unexpected call: ${url}` });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.RETELL_API_KEY = "key_test_123";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.RETELL_API_KEY;
  else process.env.RETELL_API_KEY = originalKey;
});

describe("RetellApiError", () => {
  it("prefers Retell's message field, then error, then the raw body", () => {
    expect(new RetellApiError(400, '{"message":"Bad payload"}').message).toBe("Bad payload");
    expect(new RetellApiError(400, '{"error":"Nope"}').message).toBe("Nope");
    expect(new RetellApiError(400, "plain text failure").message).toBe("plain text failure");
    expect(new RetellApiError(500, "").message).toBe("Retell request failed (500)");
    expect(new RetellApiError(400, '"just a string"').message).toBe('"just a string"');
  });

  it("carries the HTTP status and is recognised by instanceof", () => {
    const err = new RetellApiError(429, "{}");
    expect(err.status).toBe(429);
    expect(err.name).toBe("RetellApiError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RetellApiError);
  });
});

describe("request layer", () => {
  it("sends the API key and JSON content type", async () => {
    reply("/list-agents", []);
    await listAgents();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.retellai.com/list-agents");
    expect(init.headers.Authorization).toBe("Bearer key_test_123");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("refuses to call Retell without an API key", async () => {
    delete process.env.RETELL_API_KEY;
    await expect(listAgents()).rejects.toThrow(/RETELL_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws RetellApiError with Retell's message on a failure status", async () => {
    reply("/list-agents", { message: "Rate limited" }, 429);
    const err = await listAgents().catch((e) => e);
    expect(err).toBeInstanceOf(RetellApiError);
    expect(err.status).toBe(429);
    expect(err.message).toBe("Rate limited");
  });

  it("returns undefined on 204 No Content (deletes)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteAgent("agent_1")).resolves.toBeUndefined();
  });

  it("omits Content-Type for FormData bodies so the boundary survives", async () => {
    reply("/create-knowledge-base", { knowledge_base_id: "kb1" });
    const form = new FormData();
    form.append("knowledge_base_name", "Docs");

    await createKnowledgeBase(form);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("treats an empty error body as a generic failure message", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 502 }));
    const err = await listAgents().catch((e) => e);
    expect(err.message).toBe("Retell request failed (502)");
  });
});

describe("createAgent", () => {
  it("auto-creates an LLM when the payload has none", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/create-retell-llm")) return jsonResponse(200, { llm_id: "llm_new" });
      return jsonResponse(200, { agent_id: "agent_1" });
    });

    const data = { agent_name: "Reception" } as never;
    await createAgent(data);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, createInit] = fetchMock.mock.calls[1];
    const body = JSON.parse(createInit.body);
    expect(body.response_engine).toEqual({ type: "retell-llm", llm_id: "llm_new" });
    // the LLM prompt is derived from the agent name
    const [, llmInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(llmInit.body).general_prompt).toContain("Reception");
  });

  it("keeps an existing llm_id untouched", async () => {
    reply("/create-agent", { agent_id: "agent_1" });
    await createAgent({ agent_name: "X", response_engine: { type: "retell-llm", llm_id: "llm_keep" } } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_engine).toEqual({ type: "retell-llm", llm_id: "llm_keep" });
  });

  it("does not create an LLM for a custom-llm engine", async () => {
    reply("/create-agent", { agent_id: "agent_1" });
    await createAgent({
      agent_name: "X",
      response_engine: { type: "custom-llm", url: "https://llm.test/hook" },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_engine.type).toBe("custom-llm");
  });
});

describe("channel fallback (voice vs chat endpoints)", () => {
  it("falls back to the chat endpoint only on 'Invalid agent channel'", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/get-chat-agent/")) return jsonResponse(200, { agent_id: "a1", channel: "chat" });
      return jsonResponse(400, { message: "Invalid agent channel" });
    });

    const agent = await getAnyAgent("a1");
    expect(agent.channel).toBe("chat");
  });

  it("rethrows any other error instead of silently falling back", async () => {
    reply("/get-agent/a1", { message: "Agent not found" }, 404);
    await expect(getAnyAgent("a1")).rejects.toThrow("Agent not found");
  });

  it("passes a version query through to the fallback endpoint", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/get-chat-agent/")) return jsonResponse(200, { agent_id: "a1" });
      return jsonResponse(400, { message: "Invalid agent channel" });
    });

    await getAnyAgent("a1", 7);
    const chatCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/get-chat-agent/"))!;
    expect(String(chatCall[0])).toContain("?version=7");
  });

  it("updateAnyAgent falls back to PATCH /update-chat-agent", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/update-chat-agent/")) return jsonResponse(200, { agent_id: "a1" });
      return jsonResponse(400, { message: "Invalid agent channel" });
    });

    await updateAnyAgent("a1", { agent_name: "New" });
    const chatCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/update-chat-agent/"));
    expect(chatCall).toBeDefined();
    expect(chatCall![1].method).toBe("PATCH");
    expect(JSON.parse(chatCall![1].body)).toEqual({ agent_name: "New" });
  });
});

describe("listAllAgents", () => {
  it("merges voice and chat agents, keeping only the newest version", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/list-chat-agents")) {
        return jsonResponse(200, [
          { agent_id: "chat_only", channel: "chat", version: 1 },
          { agent_id: "dup", channel: "chat", version: 3 },
        ]);
      }
      return jsonResponse(200, [
        { agent_id: "voice_only", channel: "voice", version: 2 },
        { agent_id: "dup", channel: "voice", version: 5 },
      ]);
    });

    const agents = await listAllAgents();
    const byId = Object.fromEntries(agents.map((a) => [a.agent_id, a]));

    expect(Object.keys(byId).sort()).toEqual(["chat_only", "dup", "voice_only"]);
    expect(byId.dup.version).toBe(5);
  });

  it("does not swallow a chat listing failure (would orphan mappings)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/list-chat-agents")) {
        return jsonResponse(500, { message: "chat list broke" });
      }
      return jsonResponse(200, [{ agent_id: "v1", channel: "voice", version: 1 }]);
    });

    await expect(listAllAgents()).rejects.toThrow("chat list broke");
  });
});

describe("isHiddenTestChatAgent", () => {
  it("recognises the hidden test-chat naming convention only", () => {
    expect(isHiddenTestChatAgent({ agent_name: "Reception [test-chat:agent_abc123]" })).toBe(true);
    expect(isHiddenTestChatAgent({ agent_name: "Reception [test-chat:not-an-id]" })).toBe(false);
    expect(isHiddenTestChatAgent({ agent_name: "Regular agent" })).toBe(false);
    expect(isHiddenTestChatAgent({ agent_name: null })).toBe(false);
    expect(isHiddenTestChatAgent({})).toBe(false);
  });
});

describe("getOrCreateTestChatAgent", () => {
  const voiceAgent = {
    agent_id: "agent_voice",
    agent_name: "Reception",
    channel: "voice",
    language: "es-ES",
    response_engine: { type: "retell-llm", llm_id: "llm_1", version: 4 },
  };

  it("creates one when none exists, tagging it with the voice agent id", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/get-agent/")) return jsonResponse(200, voiceAgent);
      if (u.includes("/list-chat-agents")) return jsonResponse(200, []);
      if (u.includes("/create-chat-agent")) return jsonResponse(200, { agent_id: "chat_new" });
      return jsonResponse(404, { message: u });
    });

    const id = await getOrCreateTestChatAgent("agent_voice");
    expect(id).toBe("chat_new");

    const createCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/create-chat-agent"))!;
    const body = JSON.parse(createCall[1].body);
    expect(body.agent_name).toBe("Reception [test-chat:agent_voice]");
    expect(body.response_engine).toEqual(voiceAgent.response_engine);
    expect(body.language).toBe("es-ES");
  });

  it("reuses an existing test chat agent that is already in sync", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/get-agent/")) return jsonResponse(200, voiceAgent);
      if (u.includes("/list-chat-agents")) {
        return jsonResponse(200, [
          {
            agent_id: "chat_old",
            agent_name: "Reception [test-chat:agent_voice]",
            language: "es-ES",
            response_engine: { type: "retell-llm", llm_id: "llm_1", version: 4 },
          },
        ]);
      }
      return jsonResponse(404, { message: u });
    });

    expect(await getOrCreateTestChatAgent("agent_voice")).toBe("chat_old");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/create-chat-agent"))).toBe(false);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/update-chat-agent"))).toBe(false);
  });

  it("re-points an existing agent when the engine changed", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/get-agent/")) return jsonResponse(200, voiceAgent);
      if (u.includes("/list-chat-agents")) {
        return jsonResponse(200, [
          {
            agent_id: "chat_old",
            agent_name: "Reception [test-chat:agent_voice]",
            language: "es-ES",
            response_engine: { type: "retell-llm", llm_id: "llm_OUTDATED", version: 1 },
          },
        ]);
      }
      if (u.includes("/update-chat-agent")) return jsonResponse(200, { agent_id: "chat_old" });
      return jsonResponse(404, { message: u });
    });

    expect(await getOrCreateTestChatAgent("agent_voice")).toBe("chat_old");

    const updateCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/update-chat-agent"))!;
    expect(JSON.parse(updateCall[1].body).response_engine.llm_id).toBe("llm_1");
  });

  it("re-points an existing agent when only the language changed", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/get-agent/")) return jsonResponse(200, voiceAgent);
      if (u.includes("/list-chat-agents")) {
        return jsonResponse(200, [
          {
            agent_id: "chat_old",
            agent_name: "Reception [test-chat:agent_voice]",
            language: "en-US",
            response_engine: { type: "retell-llm", llm_id: "llm_1", version: 4 },
          },
        ]);
      }
      if (u.includes("/update-chat-agent")) return jsonResponse(200, { agent_id: "chat_old" });
      return jsonResponse(404, { message: u });
    });

    await getOrCreateTestChatAgent("agent_voice");
    const updateCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/update-chat-agent"))!;
    expect(JSON.parse(updateCall[1].body).language).toBe("es-ES");
  });

  it("refuses engines that cannot back a text chat", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ...voiceAgent,
        response_engine: { type: "custom-llm", url: "https://llm.test" },
      })
    );

    await expect(getOrCreateTestChatAgent("agent_voice")).rejects.toThrow(
      /only available for Retell LLM and conversational flow/
    );
  });

  it("ignores test chat agents that belong to a different voice agent", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/get-agent/")) return jsonResponse(200, voiceAgent);
      if (u.includes("/list-chat-agents")) {
        return jsonResponse(200, [
          { agent_id: "other", agent_name: "X [test-chat:agent_SOMEONE_ELSE]" },
        ]);
      }
      if (u.includes("/create-chat-agent")) return jsonResponse(200, { agent_id: "chat_new" });
      return jsonResponse(404, { message: u });
    });

    expect(await getOrCreateTestChatAgent("agent_voice")).toBe("chat_new");
  });
});

describe("deleteTestChatAgents", () => {
  it("deletes every matching test chat agent and survives individual failures", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/list-chat-agents")) {
        return jsonResponse(200, [
          { agent_id: "chat_a", agent_name: "A [test-chat:agent_v1]" },
          { agent_id: "chat_b", agent_name: "B [test-chat:agent_v1]" },
          { agent_id: "chat_other", agent_name: "C [test-chat:agent_OTHER]" },
        ]);
      }
      if (u.includes("/delete-chat-agent/chat_a")) return new Response(null, { status: 204 });
      if (u.includes("/delete-chat-agent/chat_b")) return jsonResponse(500, { message: "busy" });
      return jsonResponse(404, { message: u });
    });

    // best effort: must not throw even though one delete failed
    await expect(deleteTestChatAgents("agent_v1")).resolves.toBeUndefined();

    const deletes = fetchMock.mock.calls
      .filter(([u]) => String(u).includes("/delete-chat-agent/"))
      .map(([u]) => String(u));
    expect(deletes).toHaveLength(2);
    expect(deletes.some((u) => u.includes("chat_a"))).toBe(true);
    expect(deletes.some((u) => u.includes("chat_b"))).toBe(true);
    expect(deletes.some((u) => u.includes("chat_other"))).toBe(false);
  });

  it("does nothing when no test chat agent exists", async () => {
    reply("/list-chat-agents", []);
    await deleteTestChatAgents("agent_v1");
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("/delete-chat-agent/"))).toHaveLength(0);
  });
});

describe("listTestRuns", () => {
  it("returns the items list", async () => {
    reply("/v2/list-test-runs/", { items: [{ test_case_job_id: "j1", status: "pass" }] });
    const runs = await listTestRuns("batch_1");
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("pass");
  });

  it("returns an empty array when Retell sends no items key", async () => {
    reply("/v2/list-test-runs/", {});
    expect(await listTestRuns("batch_1")).toEqual([]);
  });
});
