import { isDemoMode } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function getServiceStatus() {
  return {
    trigger: Boolean(process.env.TRIGGER_SECRET_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    githubOAuth: Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET),
  };
}

export async function GET() {
  const services = getServiceStatus();

  if (isDemoMode()) {
    return NextResponse.json({ status: "ok", mode: "demo", services });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected", services });
  } catch (error) {
    console.error("[health] database check failed", {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { status: "error", db: "disconnected", services },
      { status: 503 }
    );
  }
}
