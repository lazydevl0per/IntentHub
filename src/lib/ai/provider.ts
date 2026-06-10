import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiProvider = "openai" | "anthropic" | "google";

function getProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === "anthropic") {
    return "anthropic";
  }
  if (provider === "google") {
    return "google";
  }
  return "openai";
}

function useGoogleForEmbeddings() {
  return (
    getProvider() === "google" ||
    (!process.env.OPENAI_API_KEY && Boolean(process.env.GOOGLE_AI_API_KEY))
  );
}

function useGoogleForChat(chatModel: string) {
  return getProvider() === "google" || chatModel.startsWith("gemini");
}

export function isAiConfigured() {
  const provider = getProvider();
  if (provider === "google") {
    return Boolean(process.env.GOOGLE_AI_API_KEY);
  }
  if (provider === "anthropic") {
    return (
      Boolean(process.env.ANTHROPIC_API_KEY) &&
      Boolean(process.env.OPENAI_API_KEY)
    );
  }
  return Boolean(process.env.OPENAI_API_KEY);
}

function getChatModel() {
  if (process.env.AI_CHAT_MODEL) {
    return process.env.AI_CHAT_MODEL;
  }
  if (getProvider() === "google") {
    return "gemini-2.0-flash";
  }
  return "gpt-4o-mini";
}

function getEmbeddingModel() {
  if (process.env.AI_EMBEDDING_MODEL) {
    return process.env.AI_EMBEDDING_MODEL;
  }
  if (useGoogleForEmbeddings()) {
    return "gemini-embedding-001";
  }
  return "text-embedding-3-small";
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

function getGoogleAI() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toGoogleContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));
}

function getGoogleSystemInstruction(messages: ChatMessage[]) {
  return messages.find((m) => m.role === "system")?.content;
}

async function googleCreateEmbedding(text: string) {
  const client = getGoogleAI();
  const response = await client.models.embedContent({
    model: getEmbeddingModel(),
    contents: text,
    config: { outputDimensionality: 1536 },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Google embedding API returned no values");
  }

  return values;
}

export async function createEmbedding(text: string, maxAttempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (useGoogleForEmbeddings()) {
        return await googleCreateEmbedding(text);
      }

      const openai = getOpenAI();
      const response = await openai.embeddings.create({
        model: getEmbeddingModel(),
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 10000));
      }
    }
  }

  throw lastError;
}

export type ChatCompletionResult = {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
};

async function anthropicChatCompletionWithUsage(messages: ChatMessage[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const system = messages.find((m) => m.role === "system")?.content;
  const conversation = messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getChatModel().startsWith("claude")
        ? getChatModel()
        : "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      system,
      messages: conversation.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error: ${body}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  return {
    content: data.content.find((c) => c.type === "text")?.text ?? "",
    promptTokens: data.usage?.input_tokens,
    completionTokens: data.usage?.output_tokens,
  };
}

async function anthropicChatCompletion(messages: ChatMessage[]) {
  const result = await anthropicChatCompletionWithUsage(messages);
  return result.content;
}

async function googleChatCompletionWithUsage(
  messages: ChatMessage[],
  model: string,
  jsonMode = false
): Promise<ChatCompletionResult> {
  const client = getGoogleAI();
  const systemInstruction = getGoogleSystemInstruction(messages);
  const contents = toGoogleContents(messages);

  const response = await client.models.generateContent({
    model,
    contents,
    config: {
      temperature: 0.2,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });

  return {
    content: response.text ?? "",
    promptTokens: response.usageMetadata?.promptTokenCount,
    completionTokens: response.usageMetadata?.candidatesTokenCount,
  };
}

async function* anthropicStreamChatCompletion(messages: ChatMessage[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const system = messages.find((m) => m.role === "system")?.content;
  const conversation = messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getChatModel().startsWith("claude")
        ? getChatModel()
        : "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      stream: true,
      system,
      messages: conversation.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error: ${body}`);
  }

  if (!response.body) {
    const result = await anthropicChatCompletionWithUsage(messages);
    yield result.content;
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };

        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta" &&
          event.delta.text
        ) {
          yield event.delta.text;
        }
      } catch {
        continue;
      }
    }
  }
}

async function* googleStreamChatCompletion(
  messages: ChatMessage[],
  model: string
) {
  const client = getGoogleAI();
  const systemInstruction = getGoogleSystemInstruction(messages);
  const contents = toGoogleContents(messages);

  const stream = await client.models.generateContentStream({
    model,
    contents,
    config: {
      temperature: 0.2,
      ...(systemInstruction ? { systemInstruction } : {}),
    },
  });

  for await (const chunk of stream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function chatCompletionWithUsage(
  messages: ChatMessage[],
  model?: string
): Promise<ChatCompletionResult> {
  const chatModel = model ?? getChatModel();

  if (useGoogleForChat(chatModel)) {
    return googleChatCompletionWithUsage(messages, chatModel);
  }

  const useOpenAI =
    getProvider() === "openai" || chatModel.startsWith("gpt");

  if (useOpenAI) {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: chatModel,
      messages,
      temperature: 0.2,
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    };
  }

  return anthropicChatCompletionWithUsage(messages);
}

export async function chatCompletion(messages: ChatMessage[]) {
  const result = await chatCompletionWithUsage(messages);
  return result.content;
}

export async function chatCompletionJson<T>(
  messages: ChatMessage[]
): Promise<T> {
  const chatModel = getChatModel();

  if (useGoogleForChat(chatModel)) {
    const result = await googleChatCompletionWithUsage(messages, chatModel, true);
    return JSON.parse(result.content || "{}") as T;
  }

  if (getProvider() === "openai" || chatModel.startsWith("gpt")) {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: chatModel,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content) as T;
  }

  const content = await anthropicChatCompletion([
    ...messages,
    {
      role: "user",
      content: "Respond with valid JSON only, no markdown fences.",
    },
  ]);

  const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned) as T;
}

export async function* streamChatCompletion(messages: ChatMessage[]) {
  const chatModel = getChatModel();

  if (useGoogleForChat(chatModel)) {
    yield* googleStreamChatCompletion(messages, chatModel);
    return;
  }

  if (getProvider() === "anthropic") {
    yield* anthropicStreamChatCompletion(messages);
    return;
  }

  const openai = getOpenAI();
  const stream = await openai.chat.completions.create({
    model: chatModel,
    messages,
    temperature: 0.2,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
