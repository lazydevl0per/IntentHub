import OpenAI from "openai";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiProvider = "openai" | "anthropic";

function getProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === "anthropic") {
    return "anthropic";
  }
  return "openai";
}

function getChatModel() {
  return process.env.AI_CHAT_MODEL ?? "gpt-4o-mini";
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createEmbedding(text: string, maxAttempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const openai = getOpenAI();
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
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

async function anthropicChatCompletion(messages: ChatMessage[]) {
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
      model: getChatModel().startsWith("claude") ? getChatModel() : "claude-3-5-haiku-20241022",
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
  };

  return data.content.find((c) => c.type === "text")?.text ?? "";
}

async function* anthropicStreamChatCompletion(messages: ChatMessage[]) {
  const content = await anthropicChatCompletion(messages);
  yield content;
}

export async function chatCompletion(messages: ChatMessage[]) {
  if (getProvider() === "anthropic") {
    return anthropicChatCompletion(messages);
  }

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: getChatModel(),
    messages,
    temperature: 0.2,
  });

  return response.choices[0]?.message?.content ?? "";
}

export async function chatCompletionJson<T>(
  messages: ChatMessage[]
): Promise<T> {
  if (getProvider() === "openai") {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: getChatModel(),
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
  if (getProvider() === "anthropic") {
    yield* anthropicStreamChatCompletion(messages);
    return;
  }

  const openai = getOpenAI();
  const stream = await openai.chat.completions.create({
    model: getChatModel(),
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
