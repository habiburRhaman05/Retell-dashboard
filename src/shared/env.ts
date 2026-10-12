import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  RETELL_API_KEY: z.string().min(1, "RETELL_API_KEY is required"),
  RETELL_WEBHOOK_SECRET: z.string().optional().default(""),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ALLOWED_FRAME_ANCESTORS: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _validated: Env | null = null;

export function validateEnv(): Env {
  if (_validated) return _validated;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  _validated = result.data;
  return result.data;
}

export function getEnv(): Env {
  return validateEnv();
}
