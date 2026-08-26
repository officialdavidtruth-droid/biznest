"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { auth } from "@/lib/auth";

/**
 * All conversations tied to this store — both order-tied threads and the
 * general "contact the store" thread started from the customer account
 * page (see lib/actions/account.ts's getOrCreateGeneralConversation).
 */
export async function listStoreConversations(slug: string) {
  const access = await assertStorePermission(slug, "messages");
  if (!access.success) return [];

  const conversations = await prisma.conversation.findMany({
    where: { storeId: access.store.id },
    include: {
      order: { include: { buyer: true } },
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  // For general (non-order-tied) threads, the "customer" to display is
  // whichever participant isn't the store's owner — participants also
  // include the owner (see getOrCreateGeneralConversation in
  // lib/actions/account.ts), so without this the list could show the
  // owner's own name instead of the customer's.
  return conversations.map((c) => ({
    ...c,
    customer: c.order?.buyer ?? c.participants.find((p) => p.user.id !== access.store.business.userId)?.user ?? null,
  }));
}

/**
 * A single conversation's full message history, for the admin thread view.
 * Scoped to this store so an admin/staff member on one store can never
 * read another store's customer messages by guessing a conversation id.
 */
export async function getStoreConversation(slug: string, conversationId: string) {
  const access = await assertStorePermission(slug, "messages");
  if (!access.success) return null;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, storeId: access.store.id },
    include: {
      order: { include: { buyer: { select: { id: true, name: true, email: true } } } },
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } },
    },
  });
  if (!conversation) return null;

  // See listStoreConversations — same "not the owner" logic for picking
  // out the customer on general (non-order-tied) threads.
  const customer =
    conversation.order?.buyer ??
    conversation.participants.find((p) => p.user.id !== access.store.business.userId)?.user ??
    null;

  return { ...conversation, customer };
}

/**
 * The store-side reply. Sender is whoever is logged into the admin
 * (owner or invited staff with the "messages" permission), not necessarily
 * the store's owner account — mirrors how sendStoreMessage on the
 * customer side attributes the message to the acting user, not the store.
 */
export async function replyToStoreConversation(
  slug: string,
  conversationId: string,
  content: string
): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "messages");
  if (!access.success) return { success: false, error: access.error };
  if (!content.trim()) return { success: false, error: "Message can't be empty." };

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, storeId: access.store.id },
    include: { participants: true },
  });
  if (!conversation) return { success: false, error: "Conversation not found." };

  const session = await auth();
  const senderId = session?.user?.id;
  if (!senderId) return { success: false, error: "You must be signed in." };

  // Owner/staff replying might not already be a listed participant (e.g. a
  // newly invited staff member replying for the first time, or the general
  // thread which was only seeded with the owner at creation) — add them so
  // they keep seeing this thread and it doesn't silently drop their replies.
  const alreadyParticipant = conversation.participants.some((p) => p.userId === senderId);
  if (!alreadyParticipant) {
    await prisma.conversationParticipant.create({
      data: { conversationId, userId: senderId },
    }).catch(() => {
      // Unique constraint race is harmless here — someone else's request
      // already added this participant.
    });
  }

  await prisma.message.create({ data: { conversationId, senderId, content: content.trim() } });

  // Notify the customer(s) in the thread, not the staff member who just sent it.
  const customerIds = conversation.participants.map((p) => p.userId).filter((id) => id !== senderId);
  await Promise.all(
    customerIds.map((userId) =>
      prisma.notification
        .create({
          data: {
            userId,
            type: "MESSAGE",
            title: "New reply from the store",
            body: content.trim().slice(0, 140),
          },
        })
        .catch(() => {})
    )
  );

  revalidatePath(`/store/${slug}/admin/messages`);
  revalidatePath(`/store/${slug}/admin/messages/${conversationId}`);
  return { success: true, data: undefined };
}
