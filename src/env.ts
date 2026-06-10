import { z } from "zod";

const baseSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  DEMO_MODE: z.string().optional(),
  NEXT_PUBLIC_DEMO_MODE: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
  TRIGGER_SECRET_KEY: z.string().optional(),
  TRIGGER_PROJECT_REF: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "anthropic", "google"]).optional(),
  AI_CHAT_MODEL: z.string().optional(),
  AI_EMBEDDING_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GITHUB_SYNC_COMMIT_LIMIT: z.string().optional(),
  GITHUB_SYNC_BRANCH_LIMIT: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  HEALTH_CHECK_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof baseSchema>;

function parseEnv() {
  return baseSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    DEMO_MODE: process.env.DEMO_MODE,
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
    TRIGGER_PROJECT_REF: process.env.TRIGGER_PROJECT_REF,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_CHAT_MODEL: process.env.AI_CHAT_MODEL,
    AI_EMBEDDING_MODEL: process.env.AI_EMBEDDING_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    GITHUB_SYNC_COMMIT_LIMIT: process.env.GITHUB_SYNC_COMMIT_LIMIT,
    GITHUB_SYNC_BRANCH_LIMIT: process.env.GITHUB_SYNC_BRANCH_LIMIT,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    HEALTH_CHECK_TOKEN: process.env.HEALTH_CHECK_TOKEN,
  });
}

export function isDemoModeEnv() {
  return (
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}

export function validateProductionEnv() {
  const env = parseEnv();
  const errors: string[] = [];

  if (env.NODE_ENV === "production" && isDemoModeEnv()) {
    errors.push("DEMO_MODE must not be enabled in production");
  }

  if (isDemoModeEnv() && env.NODE_ENV !== "production") {
    return { ok: true as const, env };
  }

  if (env.NODE_ENV === "production") {
    if (!env.DATABASE_URL) errors.push("DATABASE_URL is required");
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 16) {
      errors.push("AUTH_SECRET is required (min 16 characters)");
    }
    if (!env.NEXT_PUBLIC_APP_URL) {
      errors.push("NEXT_PUBLIC_APP_URL is required");
    }
    const aiProvider = env.AI_PROVIDER ?? "openai";
    if (aiProvider === "google") {
      if (!env.GOOGLE_AI_API_KEY) {
        errors.push("GOOGLE_AI_API_KEY is required when AI_PROVIDER=google");
      }
    } else if (!env.OPENAI_API_KEY) {
      errors.push("OPENAI_API_KEY is required (or set AI_PROVIDER=google with GOOGLE_AI_API_KEY)");
    }
    if (aiProvider === "anthropic" && !env.ANTHROPIC_API_KEY) {
      errors.push("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic");
    }
    if (!env.GITHUB_ID || !env.GITHUB_SECRET) {
      errors.push("GITHUB_ID and GITHUB_SECRET are required");
    }
    if (!env.TRIGGER_SECRET_KEY) {
      errors.push("TRIGGER_SECRET_KEY is required for production");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  return { ok: true as const, env };
}
