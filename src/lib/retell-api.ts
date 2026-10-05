import type {
  RetellAgent,
  RetellLlm,
  CreateAgentPayload,
  UpdateAgentPayload,
  ListVersionsResponse,
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
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
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
