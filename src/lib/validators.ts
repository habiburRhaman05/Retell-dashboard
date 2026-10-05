import { z } from "zod";

export const responseEngineSchema = z.object({
  type: z.enum(["retell-llm", "custom-llm", "retell-llm-multi-agent"]),
  llm_id: z.string().optional(),
  url: z.string().url().optional(),
  version: z.number().optional(),
});

export const createAgentSchema = z.object({
  agent_name: z.string().min(1, "Agent name is required"),
  response_engine: responseEngineSchema,
  voice_id: z.string().min(1, "Voice is required"),
  voice_model: z.string().optional(),
  voice_speed: z.number().min(0.5).max(2.0).optional(),
  voice_temperature: z.number().min(0).max(2.0).optional(),
  volume: z.number().min(0).max(2.0).optional(),
  language: z.string().optional(),
  webhook_url: z.string().url().optional().or(z.literal("")),
});

export const updateAgentSchema = createAgentSchema.partial();

export type CreateAgentFormData = z.infer<typeof createAgentSchema>;
export type UpdateAgentFormData = z.infer<typeof updateAgentSchema>;
