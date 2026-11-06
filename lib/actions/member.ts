"use server";

import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { sendVerificationEmail } from "@/lib/email/send";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

/**
 * Sign up as a plain member: an account for following businesses and browsing, nothing more.
 * No business, no store, no dashboard and no profile are created. A member who later wants those
 * opens a business store through the normal verification flow, which upgrades this same account.
 */
export async function registerMember(input: RegisterInput): Promise<ActionResult<{ userId: string }>> {
  const ip = getClientIp(await headers());
  const rate = await checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: `Too many signups from this connection. Try again in ${Math.ceil((rate.retryAfterSeconds ?? 3600) / 60)} minutes.` };

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };

  const email = parsed.data.email.trim().toLowerCase();
  // Same identity space as owners and staff (not store-scoped, not Marketing), so one email is one BizNest account.
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, customerScopeStoreId: null, isMarketingOnly: false }, select: { id: true } });
  if (existing) return { success: false, error: "An account with this email already exists. Sign in instead." };

  const user = await prisma.user.create({
    data: { name: parsed.data.name.trim().slice(0, 80), email, passwordHash: await bcrypt.hash(parsed.data.password, 12), role: "MEMBER", customerScopeStoreId: null },
    select: { id: true, email: true },
  });

  await prisma.verificationToken.create({ data: { identifier: user.id, token: nanoid(32), type: "EMAIL", expires: new Date(Date.now() + 24 * 60 * 60 * 1000) } })
    .then(async (t: { token: string }) => { await sendVerificationEmail(user.email, t.token); })
    .catch((err: unknown) => { console.error("Failed to send verification email:", err); });

  return { success: true, data: { userId: user.id } };
}
