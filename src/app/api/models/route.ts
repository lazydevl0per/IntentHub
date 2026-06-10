import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = process.env.AI_PROVIDER?.toLowerCase() || "openai";

  if (provider === "openai") {
    return NextResponse.json([
      "gpt-4o",
      "gpt-4o-mini",
      "o1",
      "o3-mini"
    ]);
  }

  if (provider === "anthropic") {
    return NextResponse.json([
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229"
    ]);
  }

  if (provider === "google") {
    return NextResponse.json([
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash"
    ]);
  }

  return NextResponse.json(["gpt-4o-mini"]);
}