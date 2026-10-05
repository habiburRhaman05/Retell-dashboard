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
