import { getSessionUser, unauthorized } from "@/lib/api";
import { listUserRepositories } from "@/lib/github";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const repositories = await listUserRepositories(user.id);
  return NextResponse.json(repositories);
}
