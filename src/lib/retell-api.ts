import type {
  RetellAgent,
  RetellLlm,
  CreateAgentPayload,
  UpdateAgentPayload,
  ListVersionsResponse,
  KnowledgeBase,
  CreateWebCallResponse,
  RetellVoice,
  ListCallsRequest,
  ListCallsResponse,
  RetellCall,
} from "@/types/retell";

const RETELL_BASE_URL = "https://api.retellai.com";

/** Carries Retell's own message (not the raw JSON body) so it can be shown to people as is. */
export class RetellApiError extends Error {
  status: number;
  constructor(status: number, body: string) {
    let message = body;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.message === "string") message = parsed.message;
      else if (typeof parsed?.error === "string") message = parsed.error;
    } catch {
      // body was not JSON; keep it as is
    }
    super(message || `Retell request failed (${status})`);
    this.name = "RetellApiError";
    this.status = status;
  }
}

function getApiKey(): string {
  const key = process.env.RETELL_API_KEY;
  if (!key) throw new Error("RETELL_API_KEY environment variable is not set");
  return key;
}

async function retellFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${RETELL_BASE_URL}${path}`;
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };
  // Never let an explicit Content-Type override FormData's own multipart boundary.
  if (isFormData) delete headers["Content-Type"];

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new RetellApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Agent lists -------------------------------------------------------------
// Retell retired GET /list-agents and GET /list-chat-agents. POST /v2/list-agents
// returns one paginated list of lightweight summaries for voice and chat agents;
// full settings need a get-agent / get-chat-agent call (see hydrateAgents).

export interface AgentSummary {
  agent_id: string;
  agent_name: string | null;
  channel: "voice" | "chat";
  last_modification_timestamp: number;
}

interface AgentListPage {
  items?: {
    agent_id: string;
    agent_name?: string | null;
    channel: "voice" | "chat";
    user_modified_timestamp?: number;
  }[];
  has_more?: boolean;
  pagination_key?: string;
}

const AGENT_LIST_PAGE_SIZE = 1000;
const AGENT_LIST_MAX_PAGES = 50;
const AGENT_DETAIL_CONCURRENCY = 5;

/** Every agent (or every agent of one channel), following Retell's pagination. */
export async function listAgentSummaries(channel?: "voice" | "chat"): Promise<AgentSummary[]> {
  const body = channel
    ? { filter_criteria: { channel: { type: "string", op: "eq", value: channel } } }
    : {};
  const agents: AgentSummary[] = [];
  let paginationKey: string | undefined;

  for (let page = 0; page < AGENT_LIST_MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(AGENT_LIST_PAGE_SIZE) });
    if (paginationKey) params.set("pagination_key", paginationKey);

    const res = await retellFetch<AgentListPage>(`/v2/list-agents?${params.toString()}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for (const item of res.items ?? []) {
      agents.push({
        agent_id: item.agent_id,
        agent_name: item.agent_name ?? null,
        channel: item.channel,
        last_modification_timestamp: item.user_modified_timestamp ?? 0,
      });
    }

    if (!res.has_more || !res.pagination_key) return agents;
    paginationKey = res.pagination_key;
  }
  // A silently truncated list would make callers think agents were deleted.
  throw new Error("Retell agent list has too many pages");
}

/**
 * Full settings for the given agents, fetched a few at a time. Only pass the
 * agents you actually need (e.g. one location's), never the whole account.
 */
export async function hydrateAgents(agents: AgentSummary[]): Promise<RetellAgent[]> {
  const out: RetellAgent[] = new Array(agents.length);
  let next = 0;
  let failed = false;

  async function worker() {
    while (!failed && next < agents.length) {
      const i = next++;
      const s = agents[i];
      try {
        const full =
          s.channel === "chat"
            ? await retellFetch<RetellAgent>(`/get-chat-agent/${s.agent_id}`)
            : await getAgent(s.agent_id);
        out[i] = { ...full, channel: s.channel };
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(AGENT_DETAIL_CONCURRENCY, agents.length) }, worker)
  );
  return out;
}

export async function getAgent(
  agentId: string,
  version?: number | string
): Promise<RetellAgent> {
  const params = version ? `?version=${version}` : "";
  return retellFetch<RetellAgent>(`/get-agent/${agentId}${params}`);
}

export async function createRetellLlm(
  agentName: string
): Promise<{ llm_id: string }> {
  return retellFetch<{ llm_id: string }>("/create-retell-llm", {
    method: "POST",
    body: JSON.stringify({
      model: "gpt-4o-mini",
      general_prompt: `You are ${agentName || "a helpful AI voice assistant"}. Be concise and helpful.`,
      begin_message: `Hi, this is ${agentName || "your AI assistant"}. How can I help you today?`,
      start_speaker: "agent",
    }),
  });
}

export async function createAgent(
  data: CreateAgentPayload
): Promise<RetellAgent> {
  if (!data.response_engine?.llm_id && data.response_engine?.type !== "custom-llm") {
    const llm = await createRetellLlm(data.agent_name || "AI Assistant");
    data.response_engine = {
      type: "retell-llm",
      llm_id: llm.llm_id,
    };
  }

  return retellFetch<RetellAgent>("/create-agent", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAgent(
  agentId: string,
  data: UpdateAgentPayload
): Promise<RetellAgent> {
  return retellFetch<RetellAgent>(`/update-agent/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAgent(agentId: string): Promise<void> {
  await retellFetch<void>(`/delete-agent/${agentId}`, { method: "DELETE" });
}

export async function listAgentVersions(
  agentId: string,
  limit = 50
): Promise<ListVersionsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  return retellFetch<ListVersionsResponse>(
    `/list-agent-versions/${agentId}?${params.toString()}`
  );
}

export async function createDraftVersion(
  agentId: string,
  baseVersion: number
): Promise<RetellAgent> {
  return retellFetch<RetellAgent>(`/create-agent-version/${agentId}`, {
    method: "POST",
    body: JSON.stringify({ base_version: baseVersion }),
  });
}

export async function publishAgentVersion(
  agentId: string,
  version: number,
  versionTitle?: string,
  versionDescription?: string
): Promise<void> {
  await retellFetch<void>(`/publish-agent-version/${agentId}`, {
    method: "POST",
    body: JSON.stringify({
      version,
      version_title: versionTitle,
      version_description: versionDescription,
    }),
  });
}

export async function deleteAgentVersion(agentId: string): Promise<void> {
  await retellFetch<void>(`/delete-agent-version/${agentId}`, {
    method: "DELETE",
  });
}

export async function createWebCall(
  agentId: string
): Promise<CreateWebCallResponse> {
  return retellFetch<CreateWebCallResponse>("/v3/create-web-call", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export async function listCalls(
  body: ListCallsRequest
): Promise<ListCallsResponse> {
  return retellFetch<ListCallsResponse>("/v3/list-calls", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Full detail for one call: transcript, recording URL(s), AI analysis,
 * metadata/dynamic variables. list-calls items omit most of this (verified
 * against Retell's docs, Oct 2026), so the call-history detail view always
 * fetches this separately rather than relying on the list response.
 */
export async function getCall(callId: string): Promise<RetellCall> {
  return retellFetch<RetellCall>(`/v1/get-call/${callId}`);
}

/**
 * Fetches the raw text of a call's public_log_url (a plain file Retell
 * hosts, not an api.retellai.com endpoint - no Authorization header). Kept
 * here, not in a route handler, so this stays the one place that talks to
 * anything Retell-hosted (CLAUDE.md rule: only modules/retell calls Retell).
 */
export async function fetchPublicLog(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new RetellApiError(res.status, await res.text());
  return res.text();
}

export async function getRetellLlm(llmId: string): Promise<RetellLlm> {
  return retellFetch<RetellLlm>(`/get-retell-llm/${llmId}`);
}

export async function updateRetellLlm(
  llmId: string,
  data: Partial<RetellLlm>
): Promise<RetellLlm> {
  return retellFetch<RetellLlm>(`/update-retell-llm/${llmId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return retellFetch<KnowledgeBase[]>("/list-knowledge-bases");
}

export async function getKnowledgeBase(
  knowledgeBaseId: string
): Promise<KnowledgeBase> {
  return retellFetch<KnowledgeBase>(`/get-knowledge-base/${knowledgeBaseId}`);
}

export async function createKnowledgeBase(
  form: FormData
): Promise<KnowledgeBase> {
  return retellFetch<KnowledgeBase>("/create-knowledge-base", {
    method: "POST",
    body: form,
  });
}

export async function addKnowledgeBaseSources(
  knowledgeBaseId: string,
  form: FormData
): Promise<KnowledgeBase> {
  return retellFetch<KnowledgeBase>(
    `/add-knowledge-base-sources/${knowledgeBaseId}`,
    {
      method: "POST",
      body: form,
    }
  );
}

export async function deleteKnowledgeBase(
  knowledgeBaseId: string
): Promise<void> {
  await retellFetch<void>(`/delete-knowledge-base/${knowledgeBaseId}`, {
    method: "DELETE",
  });
}

export async function deleteKnowledgeBaseSource(
  knowledgeBaseId: string,
  sourceId: string
): Promise<KnowledgeBase> {
  return retellFetch<KnowledgeBase>(
    `/delete-knowledge-base-source/${knowledgeBaseId}/source/${sourceId}`,
    { method: "DELETE" }
  );
}

export interface ChatMessage {
  message_id?: string;
  role: string;
  content?: string;
  name?: string;
  arguments?: string;
  result?: string;
  [key: string]: unknown;
}

export async function createChat(
  voiceAgentId: string,
  dynamicVariables?: Record<string, string>
): Promise<{ chat_id: string; chat_status: string }> {
  const target = await getAnyAgent(voiceAgentId);
  const chatAgentId =
    target.channel === "chat" ? voiceAgentId : await getOrCreateTestChatAgent(voiceAgentId);
  return retellFetch("/create-chat", {
    method: "POST",
    body: JSON.stringify({
      agent_id: chatAgentId,
      ...(dynamicVariables && Object.keys(dynamicVariables).length > 0
        ? { retell_llm_dynamic_variables: dynamicVariables }
        : {}),
    }),
  });
}

export async function createChatCompletion(
  chatId: string,
  content: string
): Promise<{ messages: ChatMessage[] }> {
  return retellFetch("/create-chat-completion", {
    method: "POST",
    body: JSON.stringify({ chat_id: chatId, content }),
  });
}

export async function listVoices(): Promise<RetellVoice[]> {
  return retellFetch<RetellVoice[]>("/list-voices");
}

export interface CreateLlmFromTemplate {
  model?: string;
  general_prompt: string;
  begin_message?: string;
  start_speaker?: "agent" | "user";
}

export async function createRetellLlmFromTemplate(
  data: CreateLlmFromTemplate
): Promise<{ llm_id: string }> {
  return retellFetch<{ llm_id: string }>("/create-retell-llm", {
    method: "POST",
    body: JSON.stringify({ model: "gpt-4.1", start_speaker: "agent", ...data }),
  });
}

export async function createConversationFlow(
  data: Record<string, unknown>
): Promise<{ conversation_flow_id: string }> {
  return retellFetch<{ conversation_flow_id: string }>("/create-conversation-flow", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteConversationFlow(flowId: string): Promise<void> {
  await retellFetch<void>(`/delete-conversation-flow/${flowId}`, { method: "DELETE" });
}

export async function deleteRetellLlm(llmId: string): Promise<void> {
  await retellFetch<void>(`/delete-retell-llm/${llmId}`, { method: "DELETE" });
}

/** Raw create-agent call that does not auto-create an LLM. */
export async function createAgentRaw(data: Record<string, unknown>): Promise<RetellAgent> {
  return retellFetch<RetellAgent>("/create-agent", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---- Test chat ------------------------------------------------------------
// Retell's create-chat only accepts chat agents. To let people text-test a
// voice agent we keep one hidden chat agent that points at the same response
// engine (LLM or conversation flow). It is found by tag, so nothing is stored
// on our side, and it is re-pointed whenever the voice agent's engine changes.

interface ChatAgentSummary {
  agent_id: string;
  agent_name?: string;
  language?: string | string[] | null;
  response_engine: RetellAgent["response_engine"];
}

// Chat agents do not keep assigned_tags, so the voice agent id lives in the name.
const testChatSuffix = (voiceAgentId: string) => ` [test-chat:${voiceAgentId}]`;
const isTestChatFor = (a: { agent_name?: string | null }, voiceAgentId: string) =>
  !!a.agent_name?.endsWith(testChatSuffix(voiceAgentId));

async function findTestChatAgent(voiceAgentId: string): Promise<ChatAgentSummary | undefined> {
  const hit = (await listAgentSummaries("chat")).find((a) => isTestChatFor(a, voiceAgentId));
  if (!hit) return undefined;
  return retellFetch<ChatAgentSummary>(`/get-chat-agent/${hit.agent_id}`);
}

export async function getOrCreateTestChatAgent(voiceAgentId: string): Promise<string> {
  const voiceAgent = await getAgent(voiceAgentId);
  const engine = voiceAgent.response_engine;
  if (engine.type !== "retell-llm" && engine.type !== "conversation-flow") {
    throw new Error("Text chat is only available for Retell LLM and conversational flow agents");
  }

  const existing = await findTestChatAgent(voiceAgentId);

  if (existing) {
    const same =
      existing.response_engine.type === engine.type &&
      existing.response_engine.llm_id === engine.llm_id &&
      existing.response_engine.conversation_flow_id === engine.conversation_flow_id &&
      existing.response_engine.version === engine.version;
    // The language must match too: Retell tells the model which languages the
    // agent speaks, so a test chat left on English would answer in English only.
    const sameLanguage =
      JSON.stringify(existing.language ?? "en-US") === JSON.stringify(voiceAgent.language ?? "en-US");
    if (!same || !sameLanguage) {
      await retellFetch(`/update-chat-agent/${existing.agent_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          response_engine: engine,
          ...(voiceAgent.language ? { language: voiceAgent.language } : {}),
        }),
      });
    }
    return existing.agent_id;
  }

  const created = await retellFetch<{ agent_id: string }>("/create-chat-agent", {
    method: "POST",
    body: JSON.stringify({
      agent_name: `${voiceAgent.agent_name ?? "Agent"}${testChatSuffix(voiceAgentId)}`,
      response_engine: engine,
      ...(voiceAgent.language ? { language: voiceAgent.language } : {}),
    }),
  });
  return created.agent_id;
}

/** Best effort: removes the hidden test chat agent when its voice agent is deleted. */
export async function deleteTestChatAgents(voiceAgentId: string): Promise<void> {
  const matches = (await listAgentSummaries("chat")).filter((a) => isTestChatFor(a, voiceAgentId));
  await Promise.allSettled(
    matches.map((a) => retellFetch<void>(`/delete-chat-agent/${a.agent_id}`, { method: "DELETE" }))
  );
}

// ---- Voice and text (chat) agents ------------------------------------------
// Retell keeps voice and chat agents behind separate endpoints, and rejects the
// wrong one with "Invalid agent channel". These helpers pick the right one.

const isWrongChannel = (e: unknown) =>
  e instanceof Error && e.message.includes("Invalid agent channel");

export const isHiddenTestChatAgent = (a: { agent_name?: string | null }) =>
  !!a.agent_name && /\[test-chat:agent_[^\]]+\]$/.test(a.agent_name);

export async function getAnyAgent(agentId: string, version?: number | string): Promise<RetellAgent> {
  try {
    return await getAgent(agentId, version);
  } catch (e) {
    if (!isWrongChannel(e)) throw e;
    const params = version ? `?version=${version}` : "";
    return retellFetch<RetellAgent>(`/get-chat-agent/${agentId}${params}`);
  }
}

export async function updateAnyAgent(
  agentId: string,
  data: Record<string, unknown>
): Promise<RetellAgent> {
  try {
    return await updateAgent(agentId, data as UpdateAgentPayload);
  } catch (e) {
    if (!isWrongChannel(e)) throw e;
    return retellFetch<RetellAgent>(`/update-chat-agent/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }
}

export async function deleteAnyAgent(agentId: string): Promise<void> {
  try {
    await deleteAgent(agentId);
  } catch (e) {
    if (!isWrongChannel(e)) throw e;
    await retellFetch<void>(`/delete-chat-agent/${agentId}`, { method: "DELETE" });
  }
}

export async function createChatAgentRaw(data: Record<string, unknown>): Promise<RetellAgent> {
  return retellFetch<RetellAgent>("/create-chat-agent", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---- Conversation flows ---------------------------------------------------

export async function getConversationFlow(
  flowId: string,
  version?: number
): Promise<Record<string, unknown>> {
  const q = version !== undefined && version !== null ? `?version=${version}` : "";
  return retellFetch<Record<string, unknown>>(`/get-conversation-flow/${flowId}${q}`);
}

export async function updateConversationFlow(
  flowId: string,
  data: Record<string, unknown>,
  version?: number
): Promise<Record<string, unknown>> {
  const q = version !== undefined && version !== null ? `?version=${version}` : "";
  return retellFetch<Record<string, unknown>>(`/update-conversation-flow/${flowId}${q}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Voice and text (chat) agents, one summary each. Must not swallow errors:
 * callers delete mappings for agents missing from this list, so a failed
 * listing would wrongly orphan agents.
 */
export async function listAllAgents(): Promise<AgentSummary[]> {
  return listAgentSummaries();
}

// ---- AI simulated chats (Retell test cases + batch tests) -------------------

export type SimulationEngine = {
  type: "retell-llm" | "conversation-flow";
  llm_id?: string;
  conversation_flow_id?: string;
  version?: number | null;
};

export interface TestRun {
  test_case_job_id: string;
  status: "pending" | "in_progress" | "pass" | "fail" | "error";
  test_case_definition_id: string;
  transcript_snapshot?: { transcript?: ChatMessage[] } | null;
  result_explanation?: string | null;
}

export async function createTestCaseDefinition(data: {
  name: string;
  response_engine: SimulationEngine;
  user_prompt: string;
  metrics: string[];
  dynamic_variables?: Record<string, string>;
  llm_model?: string;
}): Promise<{ test_case_definition_id: string }> {
  return retellFetch("/create-test-case-definition", {
    method: "POST",
    body: JSON.stringify({ dynamic_variables: {}, tool_mocks: [], ...data }),
  });
}

export async function deleteTestCaseDefinition(id: string): Promise<void> {
  await retellFetch<void>(`/delete-test-case-definition/${id}`, { method: "DELETE" });
}

export async function createBatchTest(
  definitionIds: string[],
  engine: SimulationEngine
): Promise<{ test_case_batch_job_id: string }> {
  return retellFetch("/create-batch-test", {
    method: "POST",
    body: JSON.stringify({ test_case_definition_ids: definitionIds, response_engine: engine }),
  });
}

export async function getBatchTest(
  batchId: string
): Promise<{ test_case_batch_job_id: string; response_engine: SimulationEngine }> {
  return retellFetch(`/get-batch-test/${batchId}`);
}

export async function listTestRuns(batchId: string): Promise<TestRun[]> {
  const res = await retellFetch<{ items: TestRun[] }>(`/v2/list-test-runs/${batchId}`);
  return res.items ?? [];
}
