import { getChatModelsForProvider } from "@/lib/ai/models";
import { getSessionUser } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = process.env.AI_PROVIDER?.toLowerCase() || "openai";
  return NextResponse.json(getChatModelsForProvider(provider));
}
