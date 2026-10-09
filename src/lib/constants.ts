export const VOICE_OPTIONS = [
  { value: "retell-Cimo", label: "Cimo" },
  { value: "retell-Willa", label: "Willa" },
  { value: "11labs-Dorothy", label: "Dorothy" },
  { value: "11labs-Jason", label: "Jason" },
  { value: "11labs-Marissa", label: "Marissa" },
  { value: "11labs-Billy", label: "Billy" },
  { value: "cartesia-Hailey-French", label: "Hailey (French)" },
  { value: "cartesia-Adam", label: "Adam" },
  { value: "cartesia-Emily", label: "Emily" },
  { value: "openai-Nova", label: "Nova (OpenAI)" },
  { value: "openai-Sage", label: "Sage (OpenAI)" },
] as const;

export const VOICE_MODEL_OPTIONS = [
  { value: "eleven_turbo_v2", label: "ElevenLabs Turbo V2" },
  { value: "eleven_flash_v2", label: "ElevenLabs Flash V2" },
  { value: "eleven_multilingual_v2", label: "ElevenLabs Multilingual V2" },
  { value: "sonic-2025-04-16", label: "Sonic (Cartesia)" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-419", label: "Spanish (Latin America)" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "it-IT", label: "Italian" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "ar-SA", label: "Arabic" },
] as const;

export const LLM_MODEL_OPTIONS = [
  { value: "gpt-4.1", label: "GPT-4.1", group: "GPT" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", group: "GPT" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano", group: "GPT" },
  { value: "gpt-5", label: "GPT-5", group: "GPT" },
  { value: "gpt-5-mini", label: "GPT-5 Mini", group: "GPT" },
  { value: "gpt-5-nano", label: "GPT-5 Nano", group: "GPT" },
  { value: "gpt-5.1", label: "GPT-5.1", group: "GPT" },
  { value: "gpt-5.2", label: "GPT-5.2", group: "GPT" },
  { value: "gpt-5.4", label: "GPT-5.4", group: "GPT" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini", group: "GPT" },
  { value: "gpt-5.4-nano", label: "GPT-5.4 Nano", group: "GPT" },
  { value: "gpt-5.5", label: "GPT-5.5", group: "GPT" },
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra", group: "GPT" },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna", group: "GPT" },
  { value: "gpt-6-astra", label: "GPT-6 Astra", group: "GPT" },
  { value: "gpt-6-sol", label: "GPT-6 Sol", group: "GPT" },
  { value: "gpt-6.1-sol", label: "GPT-6.1 Sol", group: "GPT" },
  { value: "gpt-6-luna", label: "GPT-6 Luna", group: "GPT" },
  { value: "claude-4.5-haiku", label: "Claude 4.5 Haiku", group: "Claude" },
  { value: "claude-5.5-haiku", label: "Claude 5.5 Haiku", group: "Claude" },
  { value: "claude-4.5-sonnet", label: "Claude 4.5 Sonnet", group: "Claude" },
  { value: "claude-4.6-sonnet", label: "Claude 4.6 Sonnet", group: "Claude" },
  { value: "claude-5-sonnet", label: "Claude 5 Sonnet", group: "Claude" },
  { value: "claude-5.5-sonnet", label: "Claude 5.5 Sonnet", group: "Claude" },
  { value: "claude-5-opus", label: "Claude 5 Opus", group: "Claude" },
  { value: "claude-5.5-opus", label: "Claude 5.5 Opus", group: "Claude" },
  { value: "gemini-3.0-flash", label: "Gemini 3.0 Flash", group: "Gemini" },
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", group: "Gemini" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash", group: "Gemini" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", group: "Gemini" },
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash", group: "Gemini" },
  { value: "gemini-3.7-flash", label: "Gemini 3.7 Flash", group: "Gemini" },
  { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash", group: "Gemini" },
] as const;

/** Speech-to-speech models. Mutually exclusive with `model` on a Retell LLM. */
export const S2S_MODEL_OPTIONS = [
  { value: "gpt-realtime-2.1", label: "GPT Realtime 2.1", group: "Realtime (speech to speech)" },
  { value: "gpt-realtime-2.1-mini", label: "GPT Realtime 2.1 Mini", group: "Realtime (speech to speech)" },
  { value: "gpt-realtime-2", label: "GPT Realtime 2", group: "Realtime (speech to speech)" },
  { value: "gpt-realtime-1.5", label: "GPT Realtime 1.5", group: "Realtime (speech to speech)" },
  { value: "gpt-realtime", label: "GPT Realtime", group: "Realtime (speech to speech)" },
  { value: "gpt-realtime-mini", label: "GPT Realtime Mini", group: "Realtime (speech to speech)" },
] as const;

export const RESPONSE_ENGINE_TYPES = [
  { value: "retell-llm", label: "Retell LLM" },
  { value: "custom-llm", label: "Custom LLM" },
  { value: "retell-llm-multi-agent", label: "Multi-Agent" },
] as const;

export const DEFAULTS = {
  voiceSpeed: 1.0,
  voiceTemperature: 1.0,
  volume: 1.0,
  responsiveness: 1.0,
  interruptionSensitivity: 1.0,
  backchannelFrequency: 0.8,
} as const;
