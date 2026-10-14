import { describe, it, expect, beforeEach } from "vitest";
import { FakeRetell } from "../fake";

describe("FakeRetell", () => {
  let fake: FakeRetell;

  beforeEach(() => {
    fake = new FakeRetell();
  });

  describe("agents", () => {
    it("creates and lists agents", async () => {
      const agent = await fake.createAgent({ agent_name: "Test Agent" });
      expect(agent.agent_id).toMatch(/^agent_/);
      expect(agent.agent_name).toBe("Test Agent");

      const list = await fake.listAgents();
      expect(list).toHaveLength(1);
      expect(list[0].agent_id).toBe(agent.agent_id);
    });

    it("gets agent by id", async () => {
      const created = await fake.createAgent({ agent_name: "Lookup" });
      const found = await fake.getAgent(created.agent_id);
      expect(found.agent_name).toBe("Lookup");
    });

    it("throws 404 for missing agent", async () => {
      await expect(fake.getAgent("nonexistent")).rejects.toThrow("Agent not found");
    });

    it("updates agent", async () => {
      const agent = await fake.createAgent({ agent_name: "Before" });
      const updated = await fake.updateAgent(agent.agent_id, { agent_name: "After" } as never);
      expect(updated.agent_name).toBe("After");
    });

    it("deletes agent", async () => {
      const agent = await fake.createAgent({ agent_name: "Delete me" });
      await fake.deleteAgent(agent.agent_id);
      const list = await fake.listAgents();
      expect(list).toHaveLength(0);
    });

    it("lists all agents including chat agents", async () => {
      await fake.createAgent({ agent_name: "Voice" });
      fake.chatAgents.set("chat_1", { agent_id: "chat_1", agent_name: "Chat" } as never);
      const all = await fake.listAllAgents();
      expect(all).toHaveLength(2);
    });
  });

  describe("knowledge bases", () => {
    it("creates and lists knowledge bases", async () => {
      const kb = await fake.createKnowledgeBase("Test KB");
      expect(kb.knowledge_base_id).toMatch(/^kb_/);

      const list = await fake.listKnowledgeBases();
      expect(list).toHaveLength(1);
    });

    it("deletes knowledge base", async () => {
      const kb = await fake.createKnowledgeBase("Delete me");
      await fake.deleteKnowledgeBase(kb.knowledge_base_id);
      const list = await fake.listKnowledgeBases();
      expect(list).toHaveLength(0);
    });
  });

  describe("LLMs", () => {
    it("creates and gets LLM", async () => {
      const { llm_id } = await fake.createRetellLlm("Test LLM");
      expect(llm_id).toMatch(/^llm_/);

      const llm = await fake.getRetellLlm(llm_id);
      expect(llm.llm_id).toBe(llm_id);
    });

    it("throws 404 for missing LLM", async () => {
      await expect(fake.getRetellLlm("nonexistent")).rejects.toThrow("LLM not found");
    });
  });

  describe("calls", () => {
    it("lists calls filtered by agent", async () => {
      fake.calls = [
        { call_id: "call_1", agent_id: "a1", call_status: "ended", call_type: "web_call" } as never,
        { call_id: "call_2", agent_id: "a2", call_status: "ended", call_type: "web_call" } as never,
      ];
      const res = await fake.listCalls({ filter_criteria: { agent: [{ agent_id: "a1" }] } });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].call_id).toBe("call_1");
      expect(res.has_more).toBe(false);
    });

    it("paginates with limit and skip", async () => {
      fake.calls = Array.from({ length: 5 }, (_, i) => ({
        call_id: `call_${i}`,
        agent_id: "a1",
        call_status: "ended",
        call_type: "web_call",
      })) as never;
      const res = await fake.listCalls({ limit: 2, skip: 2 });
      expect(res.items).toHaveLength(2);
      expect(res.items[0].call_id).toBe("call_2");
      expect(res.has_more).toBe(true);
    });

    it("gets a call by id", async () => {
      fake.calls = [{ call_id: "call_1", agent_id: "a1", call_status: "ended", call_type: "web_call" } as never];
      const call = await fake.getCall("call_1");
      expect(call.call_id).toBe("call_1");
    });

    it("throws 404 for missing call", async () => {
      await expect(fake.getCall("nonexistent")).rejects.toThrow("Call not found");
    });
  });

  describe("reset", () => {
    it("clears all data", async () => {
      await fake.createAgent({ agent_name: "A" });
      await fake.createKnowledgeBase("KB");
      await fake.createRetellLlm("LLM");
      fake.reset();

      expect(await fake.listAgents()).toHaveLength(0);
      expect(await fake.listKnowledgeBases()).toHaveLength(0);
    });
  });
});
