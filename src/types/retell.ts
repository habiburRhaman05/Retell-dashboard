export interface RetellResponseEngine {
  type: "retell-llm" | "custom-llm" | "retell-llm-multi-agent";
  llm_id?: string;
  url?: string;
  version?: number;
}

export interface RetellAgent {
  agent_id: string;
  agent_name: string | null;
  version: number;
  base_version: number | null;
  assigned_tags: string[];
  is_published: boolean;
  response_engine: RetellResponseEngine;
  voice_id: string;
  voice_model: string | null;
  fallback_voice_ids: string[];
  voice_temperature: number;
  voice_speed: number;
  volume: number;
  enable_dynamic_voice_speed: boolean;
  enable_dynamic_responsiveness: boolean;
  enable_expressive_mode: boolean;
  responsiveness: number;
  interruption_sensitivity: number;
  enable_backchannel: boolean;
  backchannel_frequency: number;
  backchannel_words: string[];
  reminder_trigger_ms: number;
  reminder_max_count: number;
  ambient_sound: string | null;
  ambient_sound_volume: number;
  language: string | null;
  webhook_url: string | null;
  webhook_events: string[];
  boosted_keywords: string[];
  enable_dnc_detection: boolean;
  end_call_after_silence_ms: number;
  max_call_duration_ms: number;
  post_call_analysis_data: Record<string, unknown>[];
  last_modification_timestamp: number;
}

export interface ListAgentsResponse {
  has_more: boolean;
  pagination_key: string | null;
  items: RetellAgent[];
}

export interface CreateAgentPayload {
  response_engine: RetellResponseEngine;
  voice_id: string;
  agent_name?: string;
  voice_model?: string;
  voice_speed?: number;
  voice_temperature?: number;
  volume?: number;
  language?: string;
  webhook_url?: string;
  assigned_tags?: string[];
}

export type UpdateAgentPayload = Partial<CreateAgentPayload>;

export interface RetellLlmTool {
  type: string;
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  url?: string;
  speak_during_execution?: boolean;
  speak_after_execution?: boolean;
  execution_message_description?: string;
}

export interface RetellLlm {
  llm_id: string;
  version: number;
  model: string;
  s2s_model?: string;
  general_prompt: string;
  begin_message: string | null;
  start_speaker: "agent" | "user";
  general_tools?: RetellLlmTool[];
  states?: unknown[];
  starting_state?: string;
  knowledge_base_ids?: string[];
  kb_config?: {
    top_k: number;
    filter_score: number;
  };
  model_temperature?: number;
  last_modification_timestamp: number;
  is_published: boolean;
}

export interface AgentVersion {
  version: number;
  is_published: boolean;
  version_title: string | null;
  version_description: string | null;
  base_version: number | null;
  last_modification_timestamp: number;
}

export interface ListVersionsResponse {
  has_more: boolean;
  pagination_key: string | null;
  items: AgentVersion[];
}
