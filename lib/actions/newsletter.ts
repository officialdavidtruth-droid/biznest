"use server";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import { runAutomationsForEvent } from "@/lib/automations/engine";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeToNewsletter(storeSlug: string, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { success: false, error: "Enter a valid email." };

  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "Store not found." };

  // A first signup sends a welcome email, so unthrottled this could be scripted to email arbitrary addresses.
  const { headers } = await import("next/headers");
  const ip = getClientIp(await headers());
  const [perIp, perStore, perEmail] = await Promise.all([
    checkRateLimit(`newsletter:ip:${ip}`, 10, 60 * 60 * 1000),
    checkRateLimit(`newsletter:store:${store.id}`, 200, 60 * 60 * 1000),
    checkRateLimit(`newsletter:email:${store.id}:${email}`, 3, 24 * 60 * 60 * 1000),
  ]);
  if (!perIp.allowed || !perStore.allowed || !perEmail.allowed) {
    return { success: false, error: "Too many sign-ups right now. Please try again a little later." };
  }

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { storeId_email: { storeId: store.id, email } } });

  await prisma.newsletterSubscriber.upsert({
    where: { storeId_email: { storeId: store.id, email } },
    update: { unsubscribedAt: null },
    create: { storeId: store.id, email },
  });

  if (!existing) {
    await runAutomationsForEvent({ type: "NEWSLETTER_SUBSCRIBER_CREATED", storeId: store.id, data: { email } });
  }

  return { success: true, data: undefined };
}

/**
 * Form-action wrapper for plain <form action={...}> usage. React form actions
 * receive only (formData) and must return void, so the store slug comes from a
 * hidden <input name="slug"> instead of a bound first argument.
 */
export async function subscribeToNewsletterForm(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return;
  await subscribeToNewsletter(slug, formData);
}
