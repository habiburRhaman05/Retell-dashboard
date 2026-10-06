export interface RetellResponseEngine {
  type: "retell-llm" | "custom-llm" | "retell-llm-multi-agent";
  llm_id?: string;
  url?: string;
  version?: number;
}

export type PronunciationAlphabet = "ipa" | "cmu";

export interface PronunciationEntry {
  word: string;
  alphabet: PronunciationAlphabet;
  phoneme: string;
}

export type VoicemailActionType = "hangup" | "static_text" | "prompt";

export interface VoicemailOption {
  action: {
    type: VoicemailActionType;
    text?: string;
  };
}

export interface IvrOption {
  action: {
    type: "hangup";
  };
}

export interface CallScreeningOption {
  agent_identity?: string;
  call_purpose?: string;
}

export interface UserDtmfOptions {
  digit_limit?: number | null;
  termination_key?: string | null;
  timeout_ms?: number | null;
}

export type DenoisingMode =
  | "noise-cancellation"
  | "noise-and-background-speech-cancellation"
  | "no-denoising";

export type SttMode = "fast" | "accurate" | "custom";

export type VocabSpecialization = "general" | "medical";

export type PostCallAnalysisFieldType =
  | "string"
  | "boolean"
  | "number"
  | "enum";

export interface PostCallAnalysisItem {
  type: PostCallAnalysisFieldType;
  name: string;
  description: string;
  examples?: string[];
  choices?: string[];
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
  expressive_emotion_tags?: string[];
  expressive_mode_prompt?: string | null;
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
  timezone?: string | null;
  channel?: "voice" | "phone" | "web" | string;
  webhook_url: string | null;
  webhook_events: string[];
  webhook_timeout_ms?: number;
  boosted_keywords: string[];
  pronunciation_dictionary?: PronunciationEntry[];
  vocab_specialization?: VocabSpecialization;
  stt_mode?: SttMode;
  denoising_mode?: DenoisingMode;
  enable_dnc_detection: boolean;
  allow_user_dtmf?: boolean;
  allow_dtmf_interruption?: boolean;
  user_dtmf_options?: UserDtmfOptions | null;
  voicemail_option?: VoicemailOption | null;
  ivr_option?: IvrOption | null;
  call_screening_option?: CallScreeningOption | null;
  begin_message_delay_ms?: number;
  ring_duration_ms?: number;
  contact_memory_config?: {
    enabled?: boolean;
    enable_read?: boolean;
    enable_update?: boolean;
    [key: string]: unknown;
  };
  end_call_after_silence_ms: number;
  max_call_duration_ms: number;
  post_call_analysis_data: PostCallAnalysisItem[];
  post_call_analysis_model?: string | null;
  data_storage_setting?: "everything" | "everything_except_pii" | "basic_attributes_only";
  data_storage_retention_days?: number | null;
  opt_in_signed_url?: boolean;
  last_modification_timestamp: number;
  [key: string]: unknown;
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

export const BUILTIN_TOOL_TYPES = [
  "custom",
  "end_call",
  "transfer_call",
  "press_digit",
  "send_sms",
  "extract_dynamic_variable",
] as const;

export type BuiltinToolType = (typeof BUILTIN_TOOL_TYPES)[number];

/** Covers the common tool types with structured fields; anything else from
 * Retell's wider tool catalog (agent_swap, code, mcp, integration_app, ...)
 * still round-trips through the generic fields below via raw JSON editing. */
export interface RetellLlmTool {
  type: BuiltinToolType | (string & {});
  name: string;
  description?: string;
  // custom (webhook function)
  url?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  parameters?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  response_variables?: Record<string, string>;
  timeout_ms?: number;
  // press_digit
  delay_ms?: number;
  // send_sms
  sms_content?: {
    type: "predefined" | "inferred";
    predefined_content?: string;
  };
  // transfer_call
  transfer_destination?: {
    type: "predefined" | "inferred";
    number?: string;
    prompt?: string;
  };
  transfer_option?: {
    type: "cold_transfer" | "warm_transfer";
  };
  // extract_dynamic_variable
  variables?: {
    type: PostCallAnalysisFieldType;
    name: string;
    description: string;
    choices?: string[];
  }[];
  // shared execution-message fields
  speak_during_execution?: boolean;
  speak_after_execution?: boolean;
  execution_message_description?: string;
  execution_message_type?: "prompt" | "static_text";
  [key: string]: unknown;
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

export interface CreateWebCallResponse {
  call_id: string;
  access_token: string;
  expires_at?: number;
}

export type CallStatus = "registered" | "not_connected" | "ongoing" | "ended" | "error";
export type CallDirection = "inbound" | "outbound";
export type CallType = "web_call" | "phone_call";
export type UserSentiment = "Negative" | "Positive" | "Neutral" | "Unknown";

export interface CallLatencyStat {
  p50?: number;
  p90?: number;
  p95?: number;
  p99?: number;
  max?: number;
  min?: number;
  num?: number;
}

export interface CallAnalysis {
  call_summary?: string;
  in_voicemail?: boolean;
  user_sentiment?: UserSentiment;
  call_successful?: boolean;
  custom_analysis_data?: Record<string, unknown>;
}

export interface LlmTokenUsage {
  values?: number[];
  average?: number;
  num_requests?: number;
}

export interface CallCostProductItem {
  product: string;
  unit_price?: number;
  cost: number;
  is_transfer_leg_cost?: boolean;
}

export interface CallCost {
  product_costs?: CallCostProductItem[];
  total_duration_seconds?: number;
  total_duration_unit_price?: number;
  combined_cost: number;
}

export interface RetellCall {
  call_id: string;
  agent_id: string;
  agent_name?: string;
  call_status: CallStatus;
  call_type: CallType;
  direction?: CallDirection;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  disconnection_reason?: string;
  call_analysis?: CallAnalysis;
  latency?: {
    e2e?: CallLatencyStat;
    asr?: CallLatencyStat;
    llm?: CallLatencyStat;
    llm_websocket_network_rtt?: CallLatencyStat;
    tts?: CallLatencyStat;
    knowledge_base?: CallLatencyStat;
    s2s?: CallLatencyStat;
    [key: string]: CallLatencyStat | undefined;
  };
  llm_token_usage?: LlmTokenUsage;
  call_cost?: CallCost;
  [key: string]: unknown;
}

export interface RangeFilter {
  type: "range";
  op?: "bt";
  value: [number, number];
}

export interface ListCallsFilterCriteria {
  agent?: { agent_id: string }[];
  start_timestamp?: RangeFilter;
}

export interface ListCallsRequest {
  filter_criteria?: ListCallsFilterCriteria;
  sort_order?: "ascending" | "descending";
  limit?: number;
  pagination_key?: string;
}

export interface ListCallsResponse {
  has_more: boolean;
  pagination_key: string | null;
  items: RetellCall[];
}

export interface AnalyticsSummary {
  totalCalls: number;
  avgDurationMs: number | null;
  avgLatencyMs: number | null;
  callsByDay: { date: string; count: number }[];
  concurrencyByDay: { date: string; maxConcurrent: number }[];
  callSuccessful: { successful: number; unsuccessful: number; pending: number };
  disconnectionReason: { reason: string; count: number }[];
  userSentiment: { sentiment: string; count: number }[];
  phoneDirection: { inbound: number; outbound: number };
  truncated: boolean;
}

export interface LatencyStageSummary {
  stage: string;
  avgMs: number;
  sampleCount: number;
}

export interface UsageBreakdownItem {
  label: string;
  count: number;
}

export interface AgentBreakdownItem {
  agentId: string;
  agentName: string;
  totalCalls: number;
  successRate: number | null;
  avgDurationMs: number | null;
}

export interface VoiceAiAnalyticsSummary {
  latencyByStage: LatencyStageSummary[];
  tokenUsage: {
    avgTokensPerCall: number | null;
    totalTokens: number;
    sampleCount: number;
  };
  cost: {
    totalCostCents: number;
    avgCostCentsPerCall: number | null;
    costByDay: { date: string; costCents: number }[];
  };
  agentBreakdown: AgentBreakdownItem[];
  voiceBreakdown: UsageBreakdownItem[];
  modelBreakdown: UsageBreakdownItem[];
}

export interface FullAnalyticsResponse {
  callAnalytics: AnalyticsSummary;
  voiceAiAnalytics: VoiceAiAnalyticsSummary;
}

export type KnowledgeBaseStatus =
  | "in_progress"
  | "complete"
  | "error"
  | "refreshing_in_progress";

export interface KnowledgeBaseSourceDocument {
  type: "document";
  source_id: string;
  filename: string;
  file_url: string;
  file_size?: number;
}

export interface KnowledgeBaseSourceText {
  type: "text";
  source_id: string;
  title: string;
  content_url?: string;
}

export interface KnowledgeBaseSourceUrl {
  type: "url";
  source_id: string;
  url: string;
}

export type KnowledgeBaseSource =
  | KnowledgeBaseSourceDocument
  | KnowledgeBaseSourceText
  | KnowledgeBaseSourceUrl;

export interface KnowledgeBase {
  knowledge_base_id: string;
  knowledge_base_name: string;
  status: KnowledgeBaseStatus;
  // Only present in the response when explicitly set on create — Retell
  // does not echo back its own defaults.
  max_chunk_size?: number;
  min_chunk_size?: number;
  knowledge_base_sources?: KnowledgeBaseSource[];
  enable_auto_refresh: boolean;
  last_refreshed_timestamp?: number;
  user_modified_timestamp?: number;
  auto_crawling_paths?: string[];
  error_messages?: string[];
  [key: string]: unknown;
}

export interface KnowledgeBaseTextInput {
  title: string;
  text: string;
}
