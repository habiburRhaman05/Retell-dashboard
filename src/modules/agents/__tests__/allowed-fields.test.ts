import { describe, it, expect } from "vitest";
import { filterAgentFields, isFieldAllowed } from "../allowed-fields";

describe("filterAgentFields", () => {
  it("keeps allowed fields", () => {
    const input = {
      agent_name: "Test Agent",
      voice_id: "voice_123",
      language: "en-US",
    };
    expect(filterAgentFields(input)).toEqual(input);
  });

  it("strips blocked fields", () => {
    const input = {
      agent_name: "Test Agent",
      webhook_url: "https://evil.com/hook",
      response_engine: { type: "custom" },
      llm_websocket_url: "wss://evil.com",
    };
    expect(filterAgentFields(input)).toEqual({ agent_name: "Test Agent" });
  });

  it("strips fields that are neither allowed nor blocked", () => {
    const input = {
      agent_name: "Test Agent",
      some_unknown_field: "should be removed",
      another_mystery: 42,
    };
    expect(filterAgentFields(input)).toEqual({ agent_name: "Test Agent" });
  });

  it("returns empty object when all fields are blocked", () => {
    const input = {
      webhook_url: "https://evil.com",
      response_engine: { type: "custom" },
      llm_websocket_url: "wss://evil.com",
      inbound_dynamic_variables_webhook_url: "https://evil.com/vars",
    };
    expect(filterAgentFields(input)).toEqual({});
  });

  it("handles empty input", () => {
    expect(filterAgentFields({})).toEqual({});
  });

  it("preserves all known allowed fields", () => {
    const input = {
      agent_name: "Agent",
      voice_id: "v1",
      voice_speed: 1.0,
      voice_temperature: 0.5,
      language: "en-US",
      begin_message: "Hello",
      general_prompt: "You are helpful",
      volume: 1,
      ambient_sound: "coffee-shop",
      responsiveness: 0.5,
      interruption_sensitivity: 0.5,
      backchanneling_enabled: true,
      reminder_trigger_ms: 5000,
      reminder_max_count: 3,
      end_call_after_silence_ms: 10000,
      max_call_duration_ms: 300000,
      enable_voicemail_detection: true,
      normalize_for_speech: true,
      opt_out_sensitive_data_storage: false,
    };
    const filtered = filterAgentFields(input);
    expect(Object.keys(filtered).length).toBe(Object.keys(input).length);
  });

  it("mixed: keeps allowed, strips blocked and unknown", () => {
    const input = {
      agent_name: "Agent",
      voice_id: "v1",
      webhook_url: "https://bad.com",
      stt_mode: "custom",
      unknown_field: "x",
      begin_message: "Hi",
    };
    expect(filterAgentFields(input)).toEqual({
      agent_name: "Agent",
      voice_id: "v1",
      begin_message: "Hi",
    });
  });
});

describe("isFieldAllowed", () => {
  it("returns true for allowed fields", () => {
    expect(isFieldAllowed("agent_name")).toBe(true);
    expect(isFieldAllowed("voice_id")).toBe(true);
    expect(isFieldAllowed("general_prompt")).toBe(true);
  });

  it("returns false for blocked fields", () => {
    expect(isFieldAllowed("webhook_url")).toBe(false);
    expect(isFieldAllowed("response_engine")).toBe(false);
    expect(isFieldAllowed("llm_websocket_url")).toBe(false);
    expect(isFieldAllowed("stt_mode")).toBe(false);
  });

  it("returns false for unknown fields", () => {
    expect(isFieldAllowed("some_random_field")).toBe(false);
    expect(isFieldAllowed("")).toBe(false);
  });
});
