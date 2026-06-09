import crypto from "crypto";
import { demoReadonly, getSessionUser, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user?.email) return unauthorized();

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({
    where: { identifier: user.email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      expires,
    },
  });

  return NextResponse.json({
    sent: true,
    verifyUrl: `/api/auth/verify-email/confirm?token=${token}`,
    message:
      "Verification token created. In production, this would be emailed to the user.",
  });
}
