"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { CUSTOMER_MESSAGE_LIMIT } from "@/lib/message-limits";
import { notifyStoreOfCustomerMessage } from "@/lib/notifications/notify";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { defaultFaqsFor, parseMessagingConfig, HUMAN_REQUEST_REPLY, type MessagingConfig } from "@/lib/store-chat";
import { loadStoreChat, postFaqAnswer } from "@/lib/store-auto-reply";

const PERMS = ["messages", "plugin:helpdesk"] as const;

// ---------- customer side ----------

/** The customer's one general chat with the store, created on first use. */
async function generalConversation(storeId: string, buyerId: string, ownerId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { storeId, orderId: null, participants: { some: { userId: buyerId } } },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.conversation.create({ data: { storeId, participants: { create: [{ userId: buyerId }, { userId: ownerId }] } } });
}

async function customerChatContext(slug: string) {
  const ctx = await requireStoreCustomer(slug);
  if (!ctx) return { ok: false, error: "Please sign in to your store account to chat." } as const;
  const limit = await checkRateLimit(`store-msg:${ctx.userId}`, CUSTOMER_MESSAGE_LIMIT.max, CUSTOMER_MESSAGE_LIMIT.windowMs);
  if (!limit.allowed) return { ok: false, error: "You're sending messages too quickly. Please wait a few minutes and try again." } as const;
  const chat = await loadStoreChat(ctx.storeId);
  if (!chat) return { ok: false, error: "Store not found." } as const;
  const store = await prisma.store.findUnique({ where: { id: ctx.storeId }, select: { slug: true } });
  return { ok: true, ctx, chat, storeSlug: store?.slug ?? slug } as const;
}

/** Customer taps a quick question: it is sent as their message and answered automatically. */
export async function askFaq(slug: string, faqId: string): Promise<ActionResult> {
  const c = await customerChatContext(slug);
  if (!c.ok) return { success: false, error: c.error };
  const faq = c.chat.config.faqs.find((f) => f.id === faqId && f.enabled);
  if (!faq) return { success: false, error: "That question is no longer available." };

  const convo = await generalConversation(c.ctx.storeId, c.ctx.userId, c.chat.ownerId);
  await prisma.message.create({ data: { conversationId: convo.id, senderId: c.ctx.userId, content: faq.question } });
  // A person is already handling this chat: just pass the question on, no robot reply.
  if (c.chat.config.autoReply && !convo.needsHuman) await postFaqAnswer(convo.id, c.chat.ownerId, faq);
  await notifyStoreOfCustomerMessage({
    storeId: c.ctx.storeId, storeSlug: c.storeSlug, ownerId: c.chat.ownerId, conversationId: convo.id, content: faq.question,
  });
  revalidatePath(`/store/${slug}/account/messages`);
  return { success: true, data: undefined };
}

/** Customer asks to talk to a person. Flags the chat so the team sees it at the top of the inbox. */
export async function requestHumanAgent(slug: string): Promise<ActionResult> {
  const c = await customerChatContext(slug);
  if (!c.ok) return { success: false, error: c.error };
  if (!c.chat.config.humanHandoff) return { success: false, error: "Live agent chat isn't available right now." };

  const convo = await generalConversation(c.ctx.storeId, c.ctx.userId, c.chat.ownerId);
  if (convo.needsHuman) return { success: true, data: undefined };
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: convo.id, senderId: c.ctx.userId, content: "I'd like to talk to a human agent." } }),
    prisma.message.create({ data: { conversationId: convo.id, senderId: c.chat.ownerId, content: HUMAN_REQUEST_REPLY, isAutomated: true } }),
    prisma.conversation.update({ where: { id: convo.id }, data: { needsHuman: true, humanRequestedAt: new Date() } }),
  ]);
  await notifyStoreOfCustomerMessage({
    storeId: c.ctx.storeId, storeSlug: c.storeSlug, ownerId: c.chat.ownerId, conversationId: convo.id,
    content: "A customer is asking for a human agent.",
  });
  revalidatePath(`/store/${slug}/account/messages`);
  return { success: true, data: undefined };
}

// ---------- store side ----------

export async function getMessagingConfig(slug: string) {
  const access = await assertAnyStorePermission(slug, [...PERMS]);
  if (!access.success) return null;
  const type = getCanonicalBusinessType({ businessCategory: access.store.business.category, storeBusinessType: access.store.businessType });
  return { config: parseMessagingConfig(access.store.messagingConfig, type), businessType: type, customized: !!access.store.messagingConfig };
}

export async function saveMessagingConfig(slug: string, input: MessagingConfig): Promise<ActionResult> {
  const access = await assertAnyStorePermission(slug, [...PERMS]);
  if (!access.success) return { success: false, error: access.error };
  const clean = parseMessagingConfig(input, null);
  if (clean.faqs.length > 30) return { success: false, error: "You can have up to 30 questions." };
  const seen = new Set<string>();
  const faqs = clean.faqs.map((f, i) => {
    let id = f.id;
    if (seen.has(id)) id = `f${Date.now().toString(36)}${i}`;
    seen.add(id);
    return { ...f, id };
  });
  await prisma.store.update({ where: { id: access.store.id }, data: { messagingConfig: { ...clean, faqs } } });
  revalidatePath(`/store/${slug}/admin/messages`);
  revalidatePath(`/store/${slug}/account/messages`);
  return { success: true, data: undefined };
}

export async function resetMessagingConfig(slug: string): Promise<ActionResult<{ config: MessagingConfig }>> {
  const access = await assertAnyStorePermission(slug, [...PERMS]);
  if (!access.success) return { success: false, error: access.error };
  const type = getCanonicalBusinessType({ businessCategory: access.store.business.category, storeBusinessType: access.store.businessType });
  await prisma.store.update({ where: { id: access.store.id }, data: { messagingConfig: Prisma.DbNull } });
  revalidatePath(`/store/${slug}/admin/messages`);
  revalidatePath(`/store/${slug}/account/messages`);
  return { success: true, data: { config: { autoReply: true, humanHandoff: true, faqs: defaultFaqsFor(type) } } };
}

/** Team member marks a "talk to a human" request as handled without sending a reply. */
export async function resolveHumanRequest(slug: string, conversationId: string): Promise<ActionResult> {
  const access = await assertAnyStorePermission(slug, [...PERMS]);
  if (!access.success) return { success: false, error: access.error };
  await prisma.conversation.updateMany({ where: { id: conversationId, storeId: access.store.id }, data: { needsHuman: false } });
  revalidatePath(`/store/${slug}/admin/messages`);
  revalidatePath(`/store/${slug}/admin/messages/${conversationId}`);
  return { success: true, data: undefined };
}
