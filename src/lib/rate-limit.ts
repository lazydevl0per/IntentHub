import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

let upstashLimiter: {
  limit: (key: string) => Promise<{ success: boolean }>;
} | null = null;

async function getUpstashLimiter() {
  if (upstashLimiter) return upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  const redis = new Redis({ url, token });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "intenthub",
  });

  upstashLimiter = {
    limit: async (key: string) => {
      const result = await limiter.limit(key);
      return { success: result.success };
    },
  };

  return upstashLimiter;
}

function inMemoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }

  if (bucket.count >= limit) {
    return { success: false };
  }

  bucket.count += 1;
  return { success: true };
}

export async function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
) {
  const upstash = await getUpstashLimiter();
  if (upstash) {
    return upstash.limit(key);
  }
  return inMemoryLimit(key, limit, windowMs);
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function rateLimitedResponse(
  request: Request,
  namespace: string,
  limit?: number,
  windowMs?: number
) {
  const ip = getClientIp(request);
  const result = await checkRateLimit(`${namespace}:${ip}`, limit, windowMs);

  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  return null;
}
