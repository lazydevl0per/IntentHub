import { isDemoMode } from "@/lib/demo";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function isDetailedHealthAllowed(request: Request) {
  const token = process.env.HEALTH_CHECK_TOKEN;
  if (!token) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function GET(request: Request) {
  const detailed = isDetailedHealthAllowed(request);

  if (isDemoMode()) {
    return NextResponse.json({
      status: "ok",
      mode: "demo",
      ...(detailed
        ? {
            services: {
              trigger: Boolean(process.env.TRIGGER_SECRET_KEY),
              openai: Boolean(process.env.OPENAI_API_KEY),
            },
          }
        : {}),
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    if (detailed) {
      return NextResponse.json({
        status: "ok",
        db: "connected",
        services: {
          trigger: Boolean(process.env.TRIGGER_SECRET_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          githubOAuth: Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET),
        },
      });
    }

    return NextResponse.json({ status: "ok", db: "connected" });
  } catch (error) {
    logger.error("health database check failed", {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ status: "error", db: "disconnected" }, { status: 503 });
  }
}
