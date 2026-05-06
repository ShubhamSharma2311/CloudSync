import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  VERTEX_API_KEY: z.string().min(1),
  GEMINI_MODEL_DEFAULT: z.string().default("gemini-2.5-flash"),
  GEMINI_MODEL_HIGH_STAKES: z.string().default("gemini-2.5-pro"),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  DEMO_MODE: z.coerce.boolean().default(false),
});

export type AppConfig = z.infer<typeof envSchema>;

let config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (config) return config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${result.error.message}`);
  }

  config = result.data;
  return config;
}

export function resetConfigForTests(): void {
  config = null;
}
