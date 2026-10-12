const ALLOWED_AGENT_FIELDS = new Set([
  "agent_name",
  "voice_id",
  "voice_speed",
  "voice_temperature",
  "language",
  "pronunciation_dictionary",
  "post_call_analysis_data",
  "begin_message",
  "general_prompt",
  "general_tools",
  "volume",
  "ambient_sound",
  "responsiveness",
  "interruption_sensitivity",
  "backchanneling_enabled",
  "reminder_trigger_ms",
  "reminder_max_count",
  "end_call_after_silence_ms",
  "max_call_duration_ms",
  "enable_voicemail_detection",
  "normalize_for_speech",
  "opt_out_sensitive_data_storage",
]);

const BLOCKED_FIELDS = new Set([
  "webhook_url",
  "response_engine",
  "llm_websocket_url",
  "voicemail_detection",
  "inbound_dynamic_variables_webhook_url",
  "stt_mode",
]);

export function filterAgentFields(body: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (BLOCKED_FIELDS.has(key)) continue;
    if (ALLOWED_AGENT_FIELDS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export function isFieldAllowed(field: string): boolean {
  return ALLOWED_AGENT_FIELDS.has(field) && !BLOCKED_FIELDS.has(field);
}
