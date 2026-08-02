"use server";

import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { sendVerificationEmail } from "@/lib/email/send";
import type { ActionResult } from "@/types/actions";

export async function registerUser(input: RegisterInput): Promise<ActionResult<{ userId: string }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: "CUSTOMER", // upgraded to STORE_OWNER once business verification is approved
    },
  });

  const token = nanoid(32);
  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      type: "EMAIL",
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
    },
  });

  await sendVerificationEmail(user.email, token);

  return { success: true, data: { userId: user.id } };
}
