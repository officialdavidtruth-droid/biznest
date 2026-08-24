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
  input: RegisterInput,
  storeSlug?: string
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

  let storeForCustomer: { id: string } | null = null;
  if (storeSlug) {
    storeForCustomer = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
    if (!storeForCustomer) return { success: false, error: "That store could not be found." };
  }

  // A signup's "scope" determines which other accounts it must stay
  // unique against. Store-context signups (storeSlug present) are scoped
  // to that one store only -- the same email can independently register
  // again at any other store, or here again later after this store's
  // account is deleted, as a totally separate account with its own
  // password. Generic/platform signups (pending owners, during onboarding
  // before business verification upgrades them) stay platform-scoped
  // (customerScopeStoreId: null) and must remain unique among themselves,
  // same as before. See the customerScopeStoreId field on User for the
  // full explanation, and the partial + composite unique indexes added in
  // prisma/migrations/20260823120000_customer_scoped_email.
  const scopeStoreId = storeForCustomer?.id ?? null;

  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" }, customerScopeStoreId: scopeStoreId },
  });
  if (existing) {
    return {
      success: false,
      error: scopeStoreId
        ? "You already have an account with this store. Try signing in instead."
        : "An account with this email already exists.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: normalizedEmail,
      passwordHash,
      role: "CUSTOMER", // upgraded to STORE_OWNER once business verification is approved
      customerScopeStoreId: scopeStoreId,
    },
  });

  // Signing up "through" a store (arrived via that store's AccountLink)
  // makes this a customer account for that store specifically -- it does
  // NOT grant sign-in access to any other store, and (as of the
  // customerScopeStoreId change) isn't even the same underlying account
  // as any other store's version of this email. See lib/auth.ts's
  // authorize(), which looks the account up scoped to this same store.
  if (storeForCustomer) {
    await prisma.storeCustomer.create({ data: { userId: user.id, storeId: storeForCustomer.id } });
    await prisma.storeCustomerProfile.create({ data: { userId: user.id, storeId: storeForCustomer.id, name: parsed.data.name, email: normalizedEmail } });
  }

  const token = nanoid(32);
  await prisma.verificationToken.create({
    data: {
      // The account's id, not its email -- now that the same email can
      // belong to several independent accounts (one per store), an
      // email-based identifier would be ambiguous about which one this
      // token is for. See app/verify-email/page.tsx.
      identifier: user.id,
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

  // Resolve the exact scope this request is for -- a storeSlug means
  // "this store's version of that email", no storeSlug means "the
  // platform-level account" (owner/staff/admin/pending owner). These are
  // now fully independent accounts (see customerScopeStoreId on User), so
  // the lookup must be scoped from the start rather than found generically
  // and then checked after the fact.
  let scopeStoreId: string | null = null;
  if (parsed.data.storeSlug) {
    const store = await prisma.store.findUnique({ where: { slug: parsed.data.storeSlug }, select: { id: true } });
    // Unknown store slug -- respond the same as "no matching account" so
    // this can't be used to probe for valid store slugs either.
    if (!store) return { success: true, data: undefined };
    scopeStoreId = store.id;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" }, customerScopeStoreId: scopeStoreId },
  });

  // Also rate-limit per-account so a leaked/guessed address can't be spammed
  // with reset emails even from rotating IPs.
  if (user) {
    const perEmailLimit = await checkRateLimit(`password-reset-account:${user.id}`, 3, 60 * 60 * 1000);
    if (perEmailLimit.allowed) {
      const token = nanoid(32);
      await prisma.verificationToken.create({
        data: {
          // The account's id, not its email -- the same email can now
          // belong to several independent accounts (one per store), so an
          // email-based identifier would be ambiguous about which one
          // this reset is for. The scope was already resolved above by
          // storeSlug, so the token itself doesn't need to carry it.
          identifier: user.id,
          token,
          type: "PASSWORD_RESET",
          expires: new Date(Date.now() + 1000 * 60 * 60), // 1h — shorter-lived than email verification
        },
      });
      try {
        await sendPasswordResetEmail(user.email, token, parsed.data.storeSlug);
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

  // The identifier is the account's own id (set in requestPasswordReset
  // above) -- already unambiguous about exactly which account this is for,
  // even though the same email may now belong to several independent
  // accounts across different stores. No more decoding a "STORE:slug:
  // email" string needed.
  const user = await prisma.user.findUnique({ where: { id: record.identifier }, select: { id: true, role: true, customerScopeStoreId: true } });
  if (!user) return { success: false, error: "This reset link is invalid or has expired. Request a new one." };

  // Defense in depth: if the reset form was opened with a store context,
  // confirm it actually matches the account the token is for. This
  // shouldn't ever mismatch in normal use (the token was only ever issued
  // for the store the request came from), but it costs nothing to check.
  if (parsed.data.storeSlug) {
    const store = await prisma.store.findUnique({ where: { slug: parsed.data.storeSlug }, select: { id: true } });
    if (!store || user.customerScopeStoreId !== store.id) {
      return { success: false, error: "This reset link does not belong to that store." };
    }
  } else if (user.customerScopeStoreId) {
    // A store-scoped account's reset link was opened outside any store
    // context -- shouldn't happen via the normal email link, but reject
    // defensively rather than silently reset the wrong-context account.
    return { success: false, error: "This customer password reset must be opened from the store where the account was created." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.update({
    where: { id: user.id },
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