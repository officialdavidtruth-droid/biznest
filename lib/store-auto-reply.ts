// Server-side chat automation (not a "use server" file: these helpers take ids and must never be callable from the browser).
import { prisma } from "@/lib/prisma";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { parseMessagingConfig, matchFaq, NO_MATCH_REPLY, type MessagingConfig, type StoreFaq } from "@/lib/store-chat";

export async function loadStoreChat(storeId: string): Promise<{ ownerId: string; config: MessagingConfig } | null> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { messagingConfig: true, businessType: true, business: { select: { userId: true, category: true } } },
  });
  if (!store) return null;
  const type = getCanonicalBusinessType({ businessCategory: store.business.category, storeBusinessType: store.businessType });
  return { ownerId: store.business.userId, config: parseMessagingConfig(store.messagingConfig, type) };
}

/** Posts the automated answer for an FAQ and files the conversation under its topic. */
export async function postFaqAnswer(conversationId: string, ownerId: string, faq: StoreFaq) {
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId, senderId: ownerId, content: faq.answer, isAutomated: true } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { topic: faq.topic } }),
  ]);
}

/**
 * After a customer sends free text: answer from the FAQs when one clearly matches, otherwise acknowledge once.
 * Stays quiet once a person is involved (human requested, or a team member replied in the last 2 hours).
 * Never throws: a failed auto-reply must not fail the customer's own message.
 */
export async function maybeAutoReply(input: { storeId: string; conversationId: string; text: string }) {
  try {
    const chat = await loadStoreChat(input.storeId);
    if (!chat || !chat.config.autoReply) return;
    const convo = await prisma.conversation.findUnique({ where: { id: input.conversationId }, select: { needsHuman: true } });
    if (!convo || convo.needsHuman) return;
    const recentHuman = await prisma.message.findFirst({
      where: {
        conversationId: input.conversationId,
        isAutomated: false,
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        senderId: { in: await storeSideIds(input.storeId, chat.ownerId) },
      },
      select: { id: true },
    });
    if (recentHuman) return;

    const faq = matchFaq(input.text, chat.config.faqs);
    if (faq) {
      await postFaqAnswer(input.conversationId, chat.ownerId, faq);
      return;
    }
    const alreadyAcked = await prisma.message.findFirst({
      where: { conversationId: input.conversationId, isAutomated: true, content: NO_MATCH_REPLY },
      select: { id: true },
    });
    if (!alreadyAcked) {
      await prisma.message.create({ data: { conversationId: input.conversationId, senderId: chat.ownerId, content: NO_MATCH_REPLY, isAutomated: true } });
    }
  } catch (e) {
    console.error("[auto-reply] failed", e);
  }
}

async function storeSideIds(storeId: string, ownerId: string) {
  const staff = await prisma.storeStaff.findMany({ where: { storeId }, select: { userId: true } });
  return [ownerId, ...staff.map((s) => s.userId).filter((id): id is string => !!id)];
}
