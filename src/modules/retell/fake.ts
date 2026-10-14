import type {
  RetellAgent,
  RetellLlm,
  KnowledgeBase,
  CreateWebCallResponse,
  RetellVoice,
  ListCallsResponse,
  ListCallsRequest,
  RetellCall,
} from "@/types/retell";

export class FakeRetell {
  agents = new Map<string, RetellAgent>();
  chatAgents = new Map<string, RetellAgent>();
  llms = new Map<string, RetellLlm>();
  knowledgeBases = new Map<string, KnowledgeBase>();
  voices: RetellVoice[] = [];
  calls: RetellCall[] = [];

  private nextId = 1;
  private id(prefix: string) {
    return `${prefix}_${String(this.nextId++).padStart(6, "0")}`;
  }

  reset() {
    this.agents.clear();
    this.chatAgents.clear();
    this.llms.clear();
    this.knowledgeBases.clear();
    this.voices = [];
    this.calls = [];
    this.nextId = 1;
  }

  async listAgents(): Promise<RetellAgent[]> {
    return [...this.agents.values()];
  }

  async getAgent(agentId: string): Promise<RetellAgent> {
    const a = this.agents.get(agentId) ?? this.chatAgents.get(agentId);
    if (!a) throw Object.assign(new Error("Agent not found"), { status: 404 });
    return a;
  }

  async createAgent(data: Partial<RetellAgent>): Promise<RetellAgent> {
    const id = this.id("agent");
    const agent = {
      agent_id: id,
      agent_name: data.agent_name ?? "Unnamed",
      response_engine: data.response_engine ?? { type: "retell-llm", llm_id: "llm_1" },
      voice_id: data.voice_id ?? "voice_1",
      version: 0,
      version_history: [],
      last_modification_timestamp: Date.now(),
    } as unknown as RetellAgent;
    this.agents.set(id, agent);
    return agent;
  }

  async updateAgent(agentId: string, data: Partial<RetellAgent>): Promise<RetellAgent> {
    const a = this.agents.get(agentId) ?? this.chatAgents.get(agentId);
    if (!a) throw Object.assign(new Error("Agent not found"), { status: 404 });
    Object.assign(a, data);
    return a;
  }

  async deleteAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
    this.chatAgents.delete(agentId);
  }

  async listAllAgents(): Promise<RetellAgent[]> {
    return [...this.agents.values(), ...this.chatAgents.values()];
  }

  async createRetellLlm(_name: string): Promise<{ llm_id: string }> {
    const id = this.id("llm");
    this.llms.set(id, { llm_id: id } as RetellLlm);
    return { llm_id: id };
  }

  async getRetellLlm(llmId: string): Promise<RetellLlm> {
    const llm = this.llms.get(llmId);
    if (!llm) throw Object.assign(new Error("LLM not found"), { status: 404 });
    return llm;
  }

  async updateRetellLlm(llmId: string, data: Partial<RetellLlm>): Promise<RetellLlm> {
    const llm = this.llms.get(llmId);
    if (!llm) throw Object.assign(new Error("LLM not found"), { status: 404 });
    Object.assign(llm, data);
    return llm;
  }

  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    return [...this.knowledgeBases.values()];
  }

  async getKnowledgeBase(kbId: string): Promise<KnowledgeBase> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) throw Object.assign(new Error("KB not found"), { status: 404 });
    return kb;
  }

  async createKnowledgeBase(name: string): Promise<KnowledgeBase> {
    const id = this.id("kb");
    const kb = {
      knowledge_base_id: id,
      knowledge_base_name: name,
      knowledge_base_sources: [],
      created_at: Date.now(),
    } as unknown as KnowledgeBase;
    this.knowledgeBases.set(id, kb);
    return kb;
  }

  async deleteKnowledgeBase(kbId: string): Promise<void> {
    this.knowledgeBases.delete(kbId);
  }

  async listVoices(): Promise<RetellVoice[]> {
    return this.voices;
  }

  async createWebCall(_agentId: string): Promise<CreateWebCallResponse> {
    return {
      call_id: this.id("call"),
      web_call_link: "https://fake.retell.dev/call",
      access_token: "fake-token",
    } as CreateWebCallResponse;
  }

  async listCalls(body: ListCallsRequest): Promise<ListCallsResponse> {
    const agentIds = body.filter_criteria?.agent?.map((a) => a.agent_id);
    const filtered = agentIds
      ? this.calls.filter((c) => agentIds.includes(c.agent_id))
      : this.calls;
    const limit = body.limit ?? 50;
    const skip = body.skip ?? 0;
    const page = filtered.slice(skip, skip + limit);
    return {
      items: page,
      has_more: skip + limit < filtered.length,
      pagination_key: null,
      ...(body.include_total ? { total: filtered.length } : {}),
    };
  }

  async getCall(callId: string): Promise<RetellCall> {
    const call = this.calls.find((c) => c.call_id === callId);
    if (!call) throw Object.assign(new Error("Call not found"), { status: 404 });
    return call;
  }

  async fetchPublicLog(_url: string): Promise<string> {
    return "";
  }
}

export const fakeRetell = new FakeRetell();
