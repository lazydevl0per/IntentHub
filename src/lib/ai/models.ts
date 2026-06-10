export const OPENAI_CHAT_MODELS = [
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o-mini",
  "o3",
  "o3-mini",
  "o4-mini",
] as const;

export const ANTHROPIC_CHAT_MODELS = [
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
] as const;

export const GOOGLE_CHAT_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
] as const;

export function getChatModelsForProvider(provider?: string) {
  const normalized = provider?.toLowerCase() ?? "openai";

  if (normalized === "anthropic") {
    return [...ANTHROPIC_CHAT_MODELS];
  }

  if (normalized === "google") {
    return [...GOOGLE_CHAT_MODELS];
  }

  return [...OPENAI_CHAT_MODELS];
}

export function getDefaultChatModelForProvider(provider?: string) {
  const models = getChatModelsForProvider(provider);
  return models[0];
}
