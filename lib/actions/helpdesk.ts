"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";

const KEY = "helpdesk";

export type HelpdeskThread = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  orderRef: string | null;
  lastMessage: string;
  lastFromCustomer: boolean;
  lastAt: string | null;
  waitingHours: number | null; // only set while the customer is waiting on a reply
  status: "needs_reply" | "answered" | "empty";
};

export type HelpdeskMetrics = {
  total: number;
  needsReply: number;
  waitingOver24h: number;
  answered: number;
  medianFirstResponseMinutes: number | null;
};

export async function getHelpdeskWorkspace(slug: string) {
  const a = await assertStorePermission(slug, `plugin:${KEY}`);
  if (!a.success) return { error: a.error };
  const e = await getPluginEntitlement(a.store.id, KEY);
  if (!e.allowed || !e.installed) return { error: e.reason ?? "Install this app first." };

  const storeId = a.store.id;
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Pick the 150 most recently ACTIVE conversations (by last message), not the
  // 150 most recently created — otherwise an older thread where a customer just
  // wrote back would silently drop out of the queue.
  const active = await prisma.message.groupBy({
    by: ["conversationId"],
    where: { conversation: { storeId } },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 150,
  });
  const activeIds = active.map((x) => x.conversationId);

  const [staff, convs, recentMessages] = await Promise.all([
    prisma.storeStaff.findMany({ where: { storeId, status: "ACTIVE" }, select: { userId: true } }),
    prisma.conversation.findMany({
      where: { storeId, id: { in: activeIds } },
      include: {
        order: { select: { id: true, buyer: { select: { id: true, name: true, email: true } } } },
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, senderId: true, createdAt: true } },
      },
    }),
    prisma.message.findMany({
      where: { conversation: { storeId }, createdAt: { gte: since30 } },
      select: { conversationId: true, senderId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 8000,
    }),
  ]);

  // "Store side" = the owner plus every active staff member. Anyone else in a
  // thread is the customer. (Staff who reply get added as participants, so
  // picking "whoever isn't the owner" would mislabel them as the customer.)
  const storeSide = new Set<string>([a.store.business.userId, ...staff.map((s) => s.userId).filter((id): id is string => !!id)]);
  const now = Date.now();

  const threads: HelpdeskThread[] = convs.map((c) => {
    const customer = c.order?.buyer ?? c.participants.find((p) => !storeSide.has(p.user.id))?.user ?? null;
    const last = c.messages[0] ?? null;
    const lastFromCustomer = !!last && !storeSide.has(last.senderId);
    return {
      id: c.id,
      customerName: customer?.name ?? customer?.email ?? "Customer",
      customerEmail: customer?.email ?? null,
      orderRef: c.order ? `#${c.order.id.slice(-8).toUpperCase()}` : null,
      lastMessage: last?.content ?? "",
      lastFromCustomer,
      lastAt: last?.createdAt.toISOString() ?? null,
      waitingHours: last && lastFromCustomer ? Math.max(0, Math.floor((now - last.createdAt.getTime()) / 3_600_000)) : null,
      status: !last ? "empty" : lastFromCustomer ? "needs_reply" : "answered",
    };
  });
  // Longest-waiting customers first, then answered threads by recency.
  threads.sort((x, y) => {
    if (x.status === "needs_reply" && y.status !== "needs_reply") return -1;
    if (y.status === "needs_reply" && x.status !== "needs_reply") return 1;
    if (x.status === "needs_reply" && y.status === "needs_reply") return (y.waitingHours ?? 0) - (x.waitingHours ?? 0);
    return (y.lastAt ?? "").localeCompare(x.lastAt ?? "");
  });

  // Median time from a customer's first message to the first store reply (last 30 days).
  const byConv = new Map<string, { senderId: string; createdAt: Date }[]>();
  for (const m of recentMessages) {
    const list = byConv.get(m.conversationId) ?? [];
    list.push(m);
    byConv.set(m.conversationId, list);
  }
  const responseMinutes: number[] = [];
  for (const list of byConv.values()) {
    const firstCustomer = list.find((m) => !storeSide.has(m.senderId));
    if (!firstCustomer) continue;
    const reply = list.find((m) => storeSide.has(m.senderId) && m.createdAt > firstCustomer.createdAt);
    if (reply) responseMinutes.push(Math.round((reply.createdAt.getTime() - firstCustomer.createdAt.getTime()) / 60000));
  }
  responseMinutes.sort((x, y) => x - y);
  const median = responseMinutes.length ? responseMinutes[Math.floor(responseMinutes.length / 2)] : null;

  const metrics: HelpdeskMetrics = {
    total: threads.length,
    needsReply: threads.filter((t) => t.status === "needs_reply").length,
    waitingOver24h: threads.filter((t) => (t.waitingHours ?? 0) >= 24).length,
    answered: threads.filter((t) => t.status === "answered").length,
    medianFirstResponseMinutes: median,
  };
  return { storeName: a.store.name, threads, metrics };
}
