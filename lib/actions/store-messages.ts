"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { CONVERSATIONS_PAGE_SIZE, STORE_REPLY_LIMIT, validateMessageContent } from "@/lib/message-limits";

// Conversations are reachable from the "Customer messages" permission and from
// the Customer Support app, so either grants access.
const CONVERSATION_PERMISSIONS = ["messages", "plugin:helpdesk"] as const;

/** Owner + every active staff member. Anyone else in a thread is the customer. */
async function getStoreSideIds(storeId: string, ownerId: string) {
  const staff = await prisma.storeStaff.findMany({ where: { storeId, status: "ACTIVE" }, select: { userId: true } });
  return new Set<string>([ownerId, ...staff.map((s) => s.userId).filter((id): id is string => !!id)]);
}

/**
 * Conversations tied to this store, newest activity first, one page at a time
 * (both order-tied threads and the general "contact the store" thread started
 * from the customer account page — see lib/actions/account.ts's
 * getOrCreateGeneralConversation).
 *
 * Loading stays cheap as the inbox grows:
 *  1. One aggregate query (latest message time per thread) orders ALL threads
 *     without pulling any message bodies.
 *  2. Only the requested page's threads are loaded in full, with just the
 *     columns the list renders (never the whole buyer User row).
 */
export async function listStoreConversations(slug: string, page = 1, pageSize = CONVERSATIONS_PAGE_SIZE) {
  const empty = { conversations: [], total: 0, page: 1, totalPages: 1, pageSize, denied: false };
  const access = await assertAnyStorePermission(slug, [...CONVERSATION_PERMISSIONS]);
  // `denied` lets the page say "no access" instead of the misleading
  // "No conversations yet" it would show for an empty list.
  if (!access.success) return { ...empty, denied: true };

  const storeId = access.store.id;
  // Needed both to count unread customer messages and to pick out the
  // customer on each thread.
  const storeSide = await getStoreSideIds(storeId, access.store.business.userId);
  const storeSideIds = [...storeSide];

  // 1. Ordering pass: ids + creation time, plus last-activity per thread.
  const [threads, activity] = await Promise.all([
    prisma.conversation.findMany({ where: { storeId }, select: { id: true, createdAt: true } }),
    prisma.message.groupBy({
      by: ["conversationId"],
      where: { conversation: { storeId } },
      _max: { createdAt: true },
    }),
  ]);
  const lastActivity = new Map(activity.map((a) => [a.conversationId, a._max.createdAt]));
  const ordered = threads
    .map((t) => ({ id: t.id, at: (lastActivity.get(t.id) ?? t.createdAt).getTime() }))
    // Most recent activity first (a new customer message should surface an old thread).
    .sort((a, b) => b.at - a.at);

  const total = ordered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const pageIds = ordered.slice((safePage - 1) * pageSize, safePage * pageSize).map((t) => t.id);
  if (pageIds.length === 0) return { ...empty, page: safePage, totalPages };

  // 2. Detail pass for this page only.
  const [rows, unread, lastMessages] = await Promise.all([
    prisma.conversation.findMany({
      where: { id: { in: pageIds }, storeId },
      select: {
        id: true,
        createdAt: true,
        order: { select: { id: true, buyer: { select: { id: true, name: true, email: true } } } },
        participants: { select: { user: { select: { id: true, name: true, email: true } } } },
      },
    }),
    // Messages from anyone outside the store side that nobody on the store
    // side has opened yet. Message.readAt on a customer message means "the
    // store has read it" (the customer side only ever marks the store's
    // messages, see account.ts).
    prisma.message.groupBy({
      by: ["conversationId"],
      where: { conversationId: { in: pageIds }, readAt: null, senderId: { notIn: storeSideIds } },
      _count: { _all: true },
    }),
    // One indexed "latest message" lookup per thread on the page. Deliberately
    // not a nested `messages: { take: 1 }`, which can load a thread's whole
    // history before trimming it.
    Promise.all(
      pageIds.map((id) =>
        prisma.message.findFirst({
          where: { conversationId: id },
          orderBy: { createdAt: "desc" },
          select: { content: true, createdAt: true, senderId: true },
        })
      )
    ),
  ]);

  const unreadById = new Map(unread.map((u) => [u.conversationId, u._count._all]));
  const lastById = new Map(pageIds.map((id, i) => [id, lastMessages[i]]));
  const rowById = new Map(rows.map((r) => [r.id, r]));

  // For general (non-order-tied) threads, the "customer" to display is
  // whichever participant isn't part of the store side — participants also
  // include the owner (see getOrCreateGeneralConversation in
  // lib/actions/account.ts), and staff who reply get added as participants,
  // so excluding only the owner would mislabel staff as the customer.
  const conversations = pageIds.flatMap((id) => {
    const c = rowById.get(id);
    if (!c) return [];
    const last = lastById.get(id) ?? null;
    return [
      {
        id: c.id,
        createdAt: c.createdAt,
        order: c.order ? { id: c.order.id } : null,
        customer: c.order?.buyer ?? c.participants.find((p) => !storeSide.has(p.user.id))?.user ?? null,
        // Kept as a 0/1-element array so the list markup reads the same as before.
        messages: last ? [{ content: last.content, createdAt: last.createdAt }] : [],
        unreadCount: unreadById.get(id) ?? 0,
        lastMessageFromStore: last ? storeSide.has(last.senderId) : false,
      },
    ];
  });

  return { conversations, total, page: safePage, totalPages, pageSize, denied: false };
}

/**
 * A single conversation's full message history, for the admin thread view.
 * Scoped to this store so an admin/staff member on one store can never
 * read another store's customer messages by guessing a conversation id.
 */
export async function getStoreConversation(slug: string, conversationId: string) {
  const access = await assertAnyStorePermission(slug, [...CONVERSATION_PERMISSIONS]);
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
  const storeSide = await getStoreSideIds(access.store.id, access.store.business.userId);
  const customer =
    conversation.order?.buyer ??
    conversation.participants.find((p) => !storeSide.has(p.user.id))?.user ??
    null;

  // Opening the thread counts as reading the customer's messages. Same
  // read-on-open pattern the customer side uses in account.ts. Best-effort:
  // a failed update must never stop the thread from loading.
  await prisma.message
    .updateMany({
      where: { conversationId: conversation.id, readAt: null, senderId: { notIn: [...storeSide] } },
      data: { readAt: new Date() },
    })
    .catch(() => {});

  // Flag every message sent by the store side (owner or any staff member) so
  // the thread can render colleagues' replies as the team, not as the customer.
  const messages = conversation.messages.map((m) => ({ ...m, fromStore: storeSide.has(m.sender.id) }));

  return { ...conversation, messages, customer };
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
  const access = await assertAnyStorePermission(slug, [...CONVERSATION_PERMISSIONS]);
  if (!access.success) return { success: false, error: access.error };
  const checked = validateMessageContent(content);
  if (!checked.ok) return { success: false, error: checked.error };
  content = checked.content;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, storeId: access.store.id },
    include: { participants: true },
  });
  if (!conversation) return { success: false, error: "Conversation not found." };

  const session = await auth();
  const senderId = session?.user?.id;
  if (!senderId) return { success: false, error: "You must be signed in." };

  const limit = await checkRateLimit(`store-reply:${senderId}`, STORE_REPLY_LIMIT.max, STORE_REPLY_LIMIT.windowMs);
  if (!limit.allowed) return { success: false, error: "You're replying too quickly. Please wait a moment and try again." };

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

  await prisma.message.create({ data: { conversationId, senderId, content } });

  // Notify the customer(s) in the thread, not the staff member who just sent it.
  // Participants also include the owner and other staff — don't tell them
  // "new reply from the store" about a reply the store itself just sent.
  const storeSide = await getStoreSideIds(access.store.id, access.store.business.userId);
  const customerIds = conversation.participants.map((p) => p.userId).filter((id) => id !== senderId && !storeSide.has(id));
  await Promise.all(
    customerIds.map((userId) =>
      prisma.notification
        .create({
          data: {
            userId,
            type: "MESSAGE",
            title: "New reply from the store",
            body: content.slice(0, 140),
          },
        })
        .catch(() => {})
    )
  );

  revalidatePath(`/store/${slug}/admin/messages`);
  revalidatePath(`/store/${slug}/admin/messages/${conversationId}`);
  return { success: true, data: undefined };
}
