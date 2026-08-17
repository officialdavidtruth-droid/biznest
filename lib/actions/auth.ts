"use server";

import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { registerSchema, forgotPasswordSchema, resetPasswordSchema, type RegisterInput, type ForgotPasswordInput, type ResetPasswordInput } from "@/lib/validations/auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email/send";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { emitPlatformWebhookEvent } from "@/lib/webhooks/dispatch";
import type { ActionResult } from "@/types/actions";

export async function registerUser(
  input: RegisterInput
): Promise<ActionResult<{ userId: string }>> {
  const ip = getClientIp(await headers());

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

  // Lowercased at the point of storage so every future lookup (login,
  // password reset, staff invites, etc.) can rely on email always being
  // stored consistently, and case-insensitive here too so
  // "Name@Gmail.com" can't register a second account alongside an existing
  // "name@gmail.com" one. See lib/auth.ts's authorize() for why login
  // itself also has to tolerate case for accounts created before this.
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const existing = await prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" } } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: normalizedEmail,
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

/**
 * Always returns success regardless of whether the email is registered —
 * a differing response here would let anyone enumerate which emails have
 * BizNest accounts. The UI shows the same "check your email" message
 * either way; only a real account actually gets a token + email.
 */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult<void>> {
  const ip = getClientIp(await headers());

  const rateLimit = await checkRateLimit(`password-reset:${ip}`, 5, 60 * 60 * 1000); // 5/hour/IP
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many reset requests from this connection. Try again in ${Math.ceil((rateLimit.retryAfterSeconds ?? 3600) / 60)} minutes.`,
    };
  }

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Enter a valid email address." };
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } } });

  // Also rate-limit per-email so a leaked/guessed address can't be spammed
  // with reset emails even from rotating IPs.
  if (user) {
    const perEmailLimit = await checkRateLimit(`password-reset-email:${user.email}`, 3, 60 * 60 * 1000);
    if (perEmailLimit.allowed) {
      const token = nanoid(32);
      await prisma.verificationToken.create({
        data: {
          identifier: user.email,
          token,
          type: "PASSWORD_RESET",
          expires: new Date(Date.now() + 1000 * 60 * 60), // 1h — shorter-lived than email verification
        },
      });
      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (err) {
        console.error("Failed to send password reset email:", err);
      }
    }
  }

  return { success: true, data: undefined };
}

export async function resetPassword(input: ResetPasswordInput): Promise<ActionResult<void>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!record || record.type !== "PASSWORD_RESET" || record.expires < new Date()) {
    return { success: false, error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.update({
    where: { email: record.identifier },
    data: {
      passwordHash,
      // Resetting a password is also a reasonable moment to clear any
      // existing lockout — the person just proved control of the mailbox.
      failedLoginAttempts: 0,
      lockedUntil: null,
      // Invalidate any other active sessions, same mechanism the
      // ban/force-logout path in lib/auth.ts's jwt() callback already
      // checks — a stolen session shouldn't survive a password reset.
      sessionsInvalidatedAt: new Date(),
    },
  });

  // One-time use — delete immediately so the same link can't be replayed.
  await prisma.verificationToken.delete({ where: { token: parsed.data.token } });

  return { success: true, data: undefined };
}
