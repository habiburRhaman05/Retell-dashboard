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
} from "@/types/retell";

const RETELL_BASE_URL = "https://api.retellai.com";

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
    throw new Error(`Retell API error ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function listAgents(): Promise<RetellAgent[]> {
  return retellFetch<RetellAgent[]>("/list-agents");
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
  const chatAgentId = await getOrCreateTestChatAgent(voiceAgentId);
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
  response_engine: RetellAgent["response_engine"];
}

// Chat agents do not keep assigned_tags, so the voice agent id lives in the name.
const testChatSuffix = (voiceAgentId: string) => ` [test-chat:${voiceAgentId}]`;
const isTestChatFor = (a: ChatAgentSummary, voiceAgentId: string) =>
  !!a.agent_name?.endsWith(testChatSuffix(voiceAgentId));

export async function listChatAgents(): Promise<ChatAgentSummary[]> {
  return retellFetch<ChatAgentSummary[]>("/list-chat-agents");
}

export async function getOrCreateTestChatAgent(voiceAgentId: string): Promise<string> {
  const voiceAgent = await getAgent(voiceAgentId);
  const engine = voiceAgent.response_engine;
  if (engine.type !== "retell-llm" && engine.type !== "conversation-flow") {
    throw new Error("Text chat is only available for Retell LLM and conversational flow agents");
  }

  const existing = (await listChatAgents()).find((a) => isTestChatFor(a, voiceAgentId));

  if (existing) {
    const same =
      existing.response_engine.type === engine.type &&
      existing.response_engine.llm_id === engine.llm_id &&
      existing.response_engine.conversation_flow_id === engine.conversation_flow_id &&
      existing.response_engine.version === engine.version;
    if (!same) {
      await retellFetch(`/update-chat-agent/${existing.agent_id}`, {
        method: "PATCH",
        body: JSON.stringify({ response_engine: engine }),
      });
    }
    return existing.agent_id;
  }

  const created = await retellFetch<{ agent_id: string }>("/create-chat-agent", {
    method: "POST",
    body: JSON.stringify({
      agent_name: `${voiceAgent.agent_name ?? "Agent"}${testChatSuffix(voiceAgentId)}`,
      response_engine: engine,
    }),
  });
  return created.agent_id;
}

/** Best effort: removes the hidden test chat agent when its voice agent is deleted. */
export async function deleteTestChatAgents(voiceAgentId: string): Promise<void> {
  const matches = (await listChatAgents()).filter((a) => isTestChatFor(a, voiceAgentId));
  await Promise.allSettled(
    matches.map((a) => retellFetch<void>(`/delete-chat-agent/${a.agent_id}`, { method: "DELETE" }))
  );
}
