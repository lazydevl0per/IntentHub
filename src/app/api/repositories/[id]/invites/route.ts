import {
  demoReadonly,
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "MEMBER"]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member || member.role !== "OWNER") return notFound();

  const invites = await prisma.repositoryInvite.findMany({
    where: { repositoryId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invites);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member || member.role !== "OWNER") return notFound();

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.repositoryInvite.upsert({
    where: {
      repositoryId_email: {
        repositoryId: id,
        email: parsed.data.email,
      },
    },
    create: {
      repositoryId: id,
      email: parsed.data.email,
      role: parsed.data.role ?? "MEMBER",
      token,
      invitedById: user.id,
      expiresAt,
    },
    update: {
      role: parsed.data.role ?? "MEMBER",
      token,
      invitedById: user.id,
      expiresAt,
      acceptedAt: null,
    },
  });

  return NextResponse.json(invite, { status: 201 });
}
