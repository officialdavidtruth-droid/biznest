"use server";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import { runAutomationsForEvent } from "@/lib/automations/engine";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeToNewsletter(storeSlug: string, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { success: false, error: "Enter a valid email." };

  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) return { success: false, error: "Store not found." };

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