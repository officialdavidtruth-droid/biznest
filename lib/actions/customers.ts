"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";

export type Customer360Order = {
  id: string;
  number: string;
  total: number;
  currency: string;
  channel: "ONLINE" | "POS";
  status: string;
  createdAt: string;
  items: string[];
};

export type Customer360 = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profileId: string | null;
  userId: string | null;
  orders: number;
  spent: number;
  averageOrder: number;
  lastPurchase: string | null;
  firstPurchase: string | null;
  onlineOrders: number;
  posOrders: number;
  notes: string | null;
  ordersList: Customer360Order[];
  topProducts: { name: string; quantity: number; revenue: number }[];
};

const PAID_STATUSES = SELLER_VISIBLE_ORDER_STATUSES;

function norm(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function phoneNorm(value: string | null | undefined) {
  return value?.replace(/[^\d+]/g, "") || null;
}

export async function getCustomer360(slug: string): Promise<Customer360[]> {
  const access = await assertStorePermission(slug, "customers");
  if (!access.success) return [];

  const [profiles, orders] = await Promise.all([
    prisma.storeCustomerProfile.findMany({
      where: { storeId: access.store.id },
      select: { id: true, userId: true, name: true, email: true, phone: true, notes: true },
    }),
    prisma.order.findMany({
      where: { storeId: access.store.id, status: { in: PAID_STATUSES } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, buyerId: true, total: true, currency: true, channel: true, status: true,
        createdAt: true, posCustomerName: true, posCustomerPhone: true,
        customerProfileId: true,
        buyer: { select: { name: true, email: true, phone: true } },
        items: { select: { quantity: true, unitPrice: true, product: { select: { name: true } }, service: { select: { name: true } } } },
      },
    }),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const profileByIdentity = new Map<string, string>();
  for (const p of profiles) {
    const e = norm(p.email); const ph = phoneNorm(p.phone);
    if (e) profileByIdentity.set(`e:${e}`, p.id);
    if (ph) profileByIdentity.set(`p:${ph}`, p.id);
    if (p.userId) profileByIdentity.set(`u:${p.userId}`, p.id);
  }

  type Bucket = {
    id: string; profileId: string | null; userId: string | null; name: string;
    email: string | null; phone: string | null; notes: string | null;
    orders: number; spent: number; onlineOrders: number; posOrders: number;
    lastPurchase: Date | null; firstPurchase: Date | null;
    ordersList: Customer360Order[]; products: Map<string, { name: string; quantity: number; revenue: number }>;
  };
  const buckets = new Map<string, Bucket>();

  function getBucket(o: typeof orders[number]) {
    const profile = o.customerProfileId ? profileById.get(o.customerProfileId) : undefined;
    const email = norm(profile?.email ?? o.buyer.email);
    const phone = phoneNorm(profile?.phone ?? o.posCustomerPhone ?? o.buyer.phone);
    const profileId = profile?.id ?? profileByIdentity.get(email ? `e:${email}` : "") ?? (phone ? profileByIdentity.get(`p:${phone}`) : undefined) ?? null;
    const userId = profile?.userId ?? o.buyerId ?? null;
    const key = profileId ? `profile:${profileId}` : email ? `email:${email}` : phone ? `phone:${phone}` : `user:${o.buyerId}`;
    let b = buckets.get(key);
    if (!b) {
      b = { id: key, profileId, userId, name: profile?.name ?? o.posCustomerName ?? o.buyer.name ?? "Customer", email, phone, notes: profile?.notes ?? null,
        orders: 0, spent: 0, onlineOrders: 0, posOrders: 0, lastPurchase: null, firstPurchase: null, ordersList: [], products: new Map() };
      buckets.set(key, b);
    }
    return b;
  }

  for (const o of orders) {
    const b = getBucket(o);
    const total = Number(o.total);
    b.orders += 1; b.spent += total;
    if (o.channel === "POS") b.posOrders += 1; else b.onlineOrders += 1;
    if (!b.lastPurchase || o.createdAt > b.lastPurchase) b.lastPurchase = o.createdAt;
    if (!b.firstPurchase || o.createdAt < b.firstPurchase) b.firstPurchase = o.createdAt;
    b.ordersList.push({
      id: o.id,
      number: `#${o.id.slice(-8).toUpperCase()}`,
      total, currency: o.currency, channel: o.channel, status: o.status,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => `${i.product?.name ?? i.service?.name ?? "Item"}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`),
    });
    for (const i of o.items) {
      const name = i.product?.name ?? i.service?.name ?? "Item";
      const existing = b.products.get(name) ?? { name, quantity: 0, revenue: 0 };
      existing.quantity += i.quantity; existing.revenue += Number(i.unitPrice) * i.quantity;
      b.products.set(name, existing);
    }
  }

  // Profiles without purchases are still useful CRM records and should be
  // visible so a merchant can message or create a first order for them.
  for (const p of profiles) {
    const key = `profile:${p.id}`;
    if (buckets.has(key)) continue;
    buckets.set(key, { id: key, profileId: p.id, userId: p.userId, name: p.name, email: norm(p.email), phone: phoneNorm(p.phone), notes: p.notes,
      orders: 0, spent: 0, onlineOrders: 0, posOrders: 0, lastPurchase: null, firstPurchase: null, ordersList: [], products: new Map() });
  }

  return [...buckets.values()]
    .map((b) => ({ id: b.id, name: b.name, email: b.email, phone: b.phone, profileId: b.profileId, userId: b.userId,
      orders: b.orders, spent: Math.round(b.spent * 100) / 100, averageOrder: b.orders ? Math.round((b.spent / b.orders) * 100) / 100 : 0,
      lastPurchase: b.lastPurchase?.toISOString() ?? null, firstPurchase: b.firstPurchase?.toISOString() ?? null,
      onlineOrders: b.onlineOrders, posOrders: b.posOrders, notes: b.notes,
      ordersList: b.ordersList.slice(0, 20), topProducts: [...b.products.values()].sort((a,b) => b.revenue-a.revenue).slice(0,5).map((p) => ({ ...p, revenue: Math.round(p.revenue*100)/100 })) }))
    .sort((a,b) => b.spent-a.spent || a.name.localeCompare(b.name));
}
