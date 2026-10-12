import { describe, expect, it } from "vitest";
import { createAgentSchema, responseEngineSchema, updateAgentSchema } from "./validators";

const validEngine = { type: "retell-llm" as const, llm_id: "llm_1" };

function validAgent() {
  return {
    agent_name: "Reception",
    response_engine: validEngine,
    voice_id: "voice_1",
  };
}

describe("responseEngineSchema", () => {
  it("accepts each supported engine type", () => {
    for (const type of ["retell-llm", "custom-llm", "retell-llm-multi-agent", "conversation-flow"]) {
      expect(responseEngineSchema.safeParse({ type }).success).toBe(true);
    }
  });

  it("rejects unknown engine types", () => {
    expect(responseEngineSchema.safeParse({ type: "carrier-pigeon" }).success).toBe(false);
    expect(responseEngineSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-url custom llm url", () => {
    expect(
      responseEngineSchema.safeParse({ type: "custom-llm", url: "not-a-url" }).success
    ).toBe(false);
    expect(
      responseEngineSchema.safeParse({ type: "custom-llm", url: "https://x.test/hook" }).success
    ).toBe(true);
  });
});

describe("createAgentSchema", () => {
  it("accepts a minimal valid agent", () => {
    expect(createAgentSchema.safeParse(validAgent()).success).toBe(true);
  });

  it("requires name, voice and a response engine", () => {
    expect(createAgentSchema.safeParse({ ...validAgent(), agent_name: "" }).success).toBe(false);
    expect(createAgentSchema.safeParse({ ...validAgent(), voice_id: "" }).success).toBe(false);
    expect(
      createAgentSchema.safeParse({ ...validAgent(), response_engine: { type: "nope" } }).success
    ).toBe(false);
    expect(createAgentSchema.safeParse({}).success).toBe(false);
  });

  it("bounds the voice sliders", () => {
    expect(createAgentSchema.safeParse({ ...validAgent(), voice_speed: 0.5 }).success).toBe(true);
    expect(createAgentSchema.safeParse({ ...validAgent(), voice_speed: 2.0 }).success).toBe(true);
    expect(createAgentSchema.safeParse({ ...validAgent(), voice_speed: 0.4 }).success).toBe(false);
    expect(createAgentSchema.safeParse({ ...validAgent(), voice_speed: 2.1 }).success).toBe(false);
    expect(createAgentSchema.safeParse({ ...validAgent(), voice_temperature: -0.1 }).success).toBe(false);
    expect(createAgentSchema.safeParse({ ...validAgent(), volume: 2.5 }).success).toBe(false);
  });

  it("accepts a language as string or list, and rejects other shapes", () => {
    expect(createAgentSchema.safeParse({ ...validAgent(), language: "en-US" }).success).toBe(true);
    expect(createAgentSchema.safeParse({ ...validAgent(), language: ["en-US", "fr-FR"] }).success).toBe(true);
    expect(createAgentSchema.safeParse({ ...validAgent(), language: 42 }).success).toBe(false);
  });

  it("allows webhook_url to be a valid url or explicitly empty, but not garbage", () => {
    expect(createAgentSchema.safeParse({ ...validAgent(), webhook_url: "" }).success).toBe(true);
    expect(createAgentSchema.safeParse({ ...validAgent(), webhook_url: "https://x.test/hook" }).success).toBe(true);
    expect(createAgentSchema.safeParse({ ...validAgent(), webhook_url: "nope" }).success).toBe(false);
  });
});

describe("updateAgentSchema", () => {
  it("is partial: every field optional, but invalid values still rejected", () => {
    expect(updateAgentSchema.safeParse({}).success).toBe(true);
    expect(updateAgentSchema.safeParse({ agent_name: "New name" }).success).toBe(true);
    expect(updateAgentSchema.safeParse({ voice_speed: 9 }).success).toBe(false);
  });
});
