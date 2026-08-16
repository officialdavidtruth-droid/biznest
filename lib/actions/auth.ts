"use server";

import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { sendVerificationEmail } from "@/lib/email/send";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { emitPlatformWebhookEvent } from "@/lib/webhooks/dispatch";
import type { ActionResult } from "@/types/actions";

export async function registerUser(
  input: RegisterInput,
  turnstileToken?: string
): Promise<ActionResult<{ userId: string }>> {
  const ip = getClientIp(await headers());

  // Bot protection first — cheapest check, keeps automated signups from
  // ever touching the rate limiter or DB.
  const turnstile = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstile.success) {
    return { success: false, error: "Verification failed. Please retry the challenge and try again." };
  }

  const rateLimit = await checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000); // 5/hour/IP
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many signups from this connection. Try again in ${Math.ceil((rateLimit.retryAfterSeconds ?? 3600) / 60)} minutes.`,
    };
  }

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

  try {
    await sendVerificationEmail(user.email, token);
  } catch (err) {
    // The account still exists at this point — a broken email provider
    // shouldn't block signup. Log for now; a resend-verification-email
    // action is a natural follow-up if this starts showing up often.
    console.error("Failed to send verification email:", err);
  }

  await emitPlatformWebhookEvent("CUSTOMER_CREATED", {
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return { success: true, data: { userId: user.id } };
}
