import { getSessionUser, unauthorized } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const provider = process.env.AI_PROVIDER?.toLowerCase() || "openai";

  if (provider === "google") {
    return NextResponse.json([
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash"
    ]);
  }

  if (provider === "anthropic") {
    return NextResponse.json([
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229"
    ]);
  }

  return NextResponse.json([
    "gpt-4o",
    "gpt-4o-mini",
    "o1",
    "o3-mini"
  ]);
}