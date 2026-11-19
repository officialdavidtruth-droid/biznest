"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { Prisma } from "@prisma/client";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { CONVERSATIONS_PAGE_SIZE, STORE_REPLY_LIMIT, validateMessageContent } from "@/lib/message-limits";

// Conversations are reachable from the "Customer messages" permission and from
// the Customer Support app, so either grants access.
const CONVERSATION_PERMISSIONS = ["messages", "plugin:helpdesk"] as const;

/**
 * Owner + every staff member the store has ever had, including deactivated
 * ones. Anyone else in a thread is the customer. Deliberately NOT filtered to
 * ACTIVE: a removed staff member's past replies must still count as the store
 * speaking, otherwise they'd show up as unread "customer" messages and could
 * be mislabelled as the customer on the thread.
 */
async function getStoreSideIds(storeId: string, ownerId: string) {
  const staff = await prisma.storeStaff.findMany({ where: { storeId }, select: { userId: true } });
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
export type InboxFilter = "all" | "unread" | "human";

export async function listStoreConversations(
  slug: string,
  page = 1,
  opts: { q?: string; filter?: InboxFilter; topic?: string } = {},
  pageSize = CONVERSATIONS_PAGE_SIZE
) {
  const emptyCounts = { all: 0, unread: 0, human: 0, topics: [] as { topic: string; count: number }[] };
  const empty = { conversations: [], total: 0, page: 1, totalPages: 1, pageSize, denied: false, counts: emptyCounts, matchedBy: null as string | null };
  const access = await assertAnyStorePermission(slug, [...CONVERSATION_PERMISSIONS]);
  // `denied` lets the page say "no access" instead of the misleading
  // "No conversations yet" it would show for an empty list.
  if (!access.success) return { ...empty, denied: true };

  const storeId = access.store.id;
  // Needed both to count unread customer messages and to pick out the
  // customer on each thread.
  const storeSide = await getStoreSideIds(storeId, access.store.business.userId);
  const storeSideIds = [...storeSide];

  // Inbox filters. Search looks at the customer's name/email, any message text and the FAQ topic.
  const q = (opts.q ?? "").trim().slice(0, 80);
  const filter = opts.filter ?? "all";
  const nameMatch = { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] };
  const where: Prisma.ConversationWhereInput = { storeId };
  const and: Prisma.ConversationWhereInput[] = [];
  if (opts.topic) and.push({ topic: opts.topic });
  if (filter === "human") and.push({ needsHuman: true });
  if (q) {
    and.push({
      OR: [
        { participants: { some: { userId: { notIn: storeSideIds }, user: nameMatch } } },
        { order: { buyer: nameMatch } },
        { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
        { topic: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // Unread threads store-wide: feeds the "Unread" tab, its count, and the badge numbers.
  const unreadGroups = await prisma.message.groupBy({
    by: ["conversationId"],
    where: { conversation: { storeId }, readAt: null, senderId: { notIn: storeSideIds } },
  });
  const unreadIds = unreadGroups.map((g) => g.conversationId);
  if (filter === "unread") and.push({ id: { in: unreadIds } });
  if (and.length) where.AND = and;

  const [allCount, humanCount, topicGroups] = await Promise.all([
    prisma.conversation.count({ where: { storeId } }),
    prisma.conversation.count({ where: { storeId, needsHuman: true } }),
    prisma.conversation.groupBy({ by: ["topic"], where: { storeId, topic: { not: null } }, _count: { _all: true } }),
  ]);
  const counts = {
    all: allCount,
    unread: unreadIds.length,
    human: humanCount,
    topics: topicGroups
      .filter((t): t is typeof t & { topic: string } => !!t.topic)
      .map((t) => ({ topic: t.topic, count: t._count._all }))
      .sort((a, b) => b.count - a.count),
  };

  // 1. Ordering pass: ids + creation time, plus last-activity per thread.
  const [threads, activity] = await Promise.all([
    prisma.conversation.findMany({ where, select: { id: true, createdAt: true, needsHuman: true, humanRequestedAt: true } }),
    prisma.message.groupBy({
      by: ["conversationId"],
      where: { conversation: { storeId } },
      _max: { createdAt: true },
    }),
  ]);
  const lastActivity = new Map(activity.map((a) => [a.conversationId, a._max.createdAt]));
  const ordered = threads
    .map((t) => ({ id: t.id, human: t.needsHuman, at: (lastActivity.get(t.id) ?? t.createdAt).getTime() }))
    // People waiting for a human come first, then most recent activity (a new customer message surfaces an old thread).
    .sort((a, b) => Number(b.human) - Number(a.human) || b.at - a.at);

  const total = ordered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const pageIds = ordered.slice((safePage - 1) * pageSize, safePage * pageSize).map((t) => t.id);
  if (pageIds.length === 0) return { ...empty, page: safePage, totalPages, total, counts };

  // 2. Detail pass for this page only.
  const [rows, unread, lastMessages] = await Promise.all([
    prisma.conversation.findMany({
      where: { id: { in: pageIds }, storeId },
      select: {
        id: true,
        createdAt: true,
        topic: true,
        needsHuman: true,
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

  // When searching, show the message that matched instead of just the latest one.
  const snippets = q
    ? await Promise.all(
        pageIds.map((id) =>
          prisma.message.findFirst({
            where: { conversationId: id, content: { contains: q, mode: "insensitive" } },
            orderBy: { createdAt: "desc" },
            select: { content: true },
          })
        )
      )
    : [];
  const snippetById = new Map(pageIds.map((id, i) => [id, snippets[i]?.content ?? null]));
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
        topic: c.topic,
        needsHuman: c.needsHuman,
        matchSnippet: snippetById.get(id) ?? null,
      },
    ];
  });

  return { conversations, total, page: safePage, totalPages, pageSize, denied: false, counts, matchedBy: q || null };
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
  // A person has answered, so any "talk to a human" request is now being handled.
  if (conversation.needsHuman) await prisma.conversation.update({ where: { id: conversationId }, data: { needsHuman: false } }).catch(() => {});

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
            // Customer inbox for this store (there is no per-thread customer route).
            url: `/store/${slug}/account/messages`,
          },
        })
        .catch(() => {})
    )
  );

  revalidatePath(`/store/${slug}/admin/messages`);
  revalidatePath(`/store/${slug}/admin/messages/${conversationId}`);
  return { success: true, data: undefined };
}
