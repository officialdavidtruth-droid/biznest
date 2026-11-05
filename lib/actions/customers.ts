"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";
import { walkInEmail } from "@/lib/walk-in-customer";
import { phoneKey } from "@/lib/phone";
import { findMixedCurrencies } from "@/lib/currency-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

export type Customer360Order = {
  id: string;
  number: string;
  total: number;
  currency: string;
  channel: "ONLINE" | "POS" | "BOOKING";
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
  // Paid, non-cancelled service bookings (these also count in orders/spent).
  bookingCount: number;
  notes: string | null;
  ordersList: Customer360Order[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  bills: Customer360Bill[];
  // Hotel room charges, kept apart from product/service order metrics so they
  // never skew average order. Void charges are excluded everywhere.
  roomChargesPaid: number;
  roomChargesOpen: number;
};

export type Customer360Bill = { id: string; description: string; category: string | null; amount: number; currency: string; status: string; room: string | null; reservationId: string; postedAt: string };

// Orders the seller can see (includes refunded/disputed so the history stays
// complete)...
const PAID_STATUSES = SELLER_VISIBLE_ORDER_STATUSES;
// ...but money that was refunded, or is under dispute, is not revenue. These
// stay in the order list for context and are excluded from every metric.
const NON_REVENUE_STATUSES = new Set<string>(["REFUNDED", "DISPUTED"]);

function norm(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function phoneNorm(value: string | null | undefined) {
  return value?.replace(/[^\d+]/g, "") || null;
}

export type Customer360Result = {
  customers: Customer360[];
  // What this business actually does, set once at onboarding — drives
  // whether the UI calls this page "Customer 360" or "Client 360" and
  // whether it shows POS/online-channel breakdowns. Hybrid stores (both
  // true) keep the full customer-style view since they do run POS sales.
  sellsProducts: boolean;
  offersServices: boolean;
  // Anonymous POS sales (no customer recorded). Reported separately so they
  // don't appear as one giant "Walk-in customer" and skew customer metrics.
  walkIn: { orders: number; spent: number };
  // A store operates in one currency (see lib/store-currency.ts), so amounts are
  // formatted in it. If any counted order/booking was recorded in a different
  // currency (e.g. the store's currency was changed later), these are listed and
  // the UI warns that totals are not converted.
  currency: string;
  locale: string | null;
  mixedCurrencies: string[] | null;
};

export async function getCustomer360(slug: string): Promise<Customer360Result> {
  const access = await assertStorePermission(slug, "customers");
  if (!access.success) return { customers: [], sellsProducts: true, offersServices: false, walkIn: { orders: 0, spent: 0 }, currency: "NGN", locale: null, mixedCurrencies: null };
  const { sellsProducts, offersServices } = access.store.business;

  const [profiles, orders, bookings, folioTotals] = await Promise.all([
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
    // Service bookings are their own records (not Orders): a booking carries its
    // own payment status/amount, so a service business's revenue lives here.
    prisma.booking.findMany({
      where: { storeId: access.store.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, referenceCode: true, buyerId: true, status: true, paymentStatus: true, paymentAmount: true, paymentCurrency: true,
        createdAt: true, guestName: true, guestPhone: true, guestEmail: true,
        service: { select: { name: true } },
        buyer: { select: { name: true, email: true, phone: true } },
      },
    }),
    // Exact per-guest totals from the database (not from a capped row list).
    // For a store with no PMS this returns nothing and the guest query below
    // is skipped.
    prisma.propertyFolioCharge.groupBy({
      by: ["guestId", "status"],
      where: { storeId: access.store.id, status: { not: "VOID" } },
      _sum: { amount: true },
    }),
  ]);

  const guestIds = [...new Set(folioTotals.map((t) => t.guestId))];
  const guests = guestIds.length
    ? await prisma.propertyGuest.findMany({
        where: { storeId: access.store.id, id: { in: guestIds } },
        select: {
          id: true, fullName: true, email: true, phone: true, notes: true,
          // Most recent 30 per guest, so one busy guest can't crowd out the rest.
          folioCharges: {
            where: { status: { not: "VOID" } },
            orderBy: { postedAt: "desc" },
            take: 30,
            include: { reservation: { include: { room: true } } },
          },
        },
      })
    : [];
  const totalsByGuest = new Map<string, { paid: number; open: number }>();
  for (const t of folioTotals) {
    const cur = totalsByGuest.get(t.guestId) ?? { paid: 0, open: 0 };
    const amt = Number(t._sum.amount ?? 0);
    if (t.status === "PAID") cur.paid += amt; else cur.open += amt;
    totalsByGuest.set(t.guestId, cur);
  }

  const walkInAddr = walkInEmail(access.store.id);
  const isWalkInBuyer = (email: string | null | undefined) => norm(email) === walkInAddr;
  const walkIn = { orders: 0, spent: 0 };
  const storeCurrency = (access.store.currency || "NGN").toUpperCase();
  const currenciesSeen = new Set<string>();

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const profileByIdentity = new Map<string, string>();
  for (const p of profiles) {
    const e = norm(p.email); const ph = phoneKey(p.phone);
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
    bills: Customer360Bill[];
    roomPaid: number; roomOpen: number; bookingCount: number;
  };
  const buckets = new Map<string, Bucket>();

  function getBucket(o: typeof orders[number]) {
    const profile = o.customerProfileId ? profileById.get(o.customerProfileId) : undefined;
    // The shared walk-in user's internal address/id must never be shown as a
    // real customer's email or account.
    const walkInBuyer = isWalkInBuyer(o.buyer.email);
    const email = norm(profile?.email ?? (walkInBuyer ? null : o.buyer.email));
    const phone = phoneNorm(profile?.phone ?? o.posCustomerPhone ?? o.buyer.phone);
    // Matching uses phoneKey so 0803…, +234803… and 234803… are one person;
    // `phone` stays the display/contact value.
    const pk = phoneKey(phone);
    const profileId = profile?.id ?? profileByIdentity.get(email ? `e:${email}` : "") ?? (pk ? profileByIdentity.get(`p:${pk}`) : undefined) ?? null;
    const userId = profile?.userId ?? (walkInBuyer ? null : o.buyerId) ?? null;
    const key = profileId ? `profile:${profileId}` : email ? `email:${email}` : pk ? `phone:${pk}` : `user:${o.buyerId}`;
    let b = buckets.get(key);
    if (!b) {
      b = { id: key, profileId, userId, name: profile?.name ?? o.posCustomerName ?? o.buyer.name ?? "Customer", email, phone, notes: profile?.notes ?? null,
        orders: 0, spent: 0, onlineOrders: 0, posOrders: 0, lastPurchase: null, firstPurchase: null, ordersList: [], products: new Map(), bills: [], roomPaid: 0, roomOpen: 0, bookingCount: 0 };
      buckets.set(key, b);
    }
    return b;
  }

  for (const o of orders) {
    const countsAsRevenue = !NON_REVENUE_STATUSES.has(o.status);
    if (isWalkInBuyer(o.buyer.email) && !o.customerProfileId) {
      if (countsAsRevenue) {
        currenciesSeen.add(o.currency);
        walkIn.orders += 1;
        walkIn.spent += Number(o.total);
      }
      continue;
    }
    const b = getBucket(o);
    const total = Number(o.total);
    if (countsAsRevenue) {
      currenciesSeen.add(o.currency);
      b.orders += 1; b.spent += total;
      if (o.channel === "POS") b.posOrders += 1; else b.onlineOrders += 1;
      if (!b.lastPurchase || o.createdAt > b.lastPurchase) b.lastPurchase = o.createdAt;
      if (!b.firstPurchase || o.createdAt < b.firstPurchase) b.firstPurchase = o.createdAt;
    }
    b.ordersList.push({
      id: o.id,
      number: `#${o.id.slice(-8).toUpperCase()}`,
      total, currency: o.currency, channel: o.channel, status: o.status,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => `${i.product?.name ?? i.service?.name ?? "Item"}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`),
    });
    if (!countsAsRevenue) continue;
    for (const i of o.items) {
      const name = i.product?.name ?? i.service?.name ?? "Item";
      const existing = b.products.get(name) ?? { name, quantity: 0, revenue: 0 };
      existing.quantity += i.quantity; existing.revenue += Number(i.unitPrice) * i.quantity;
      b.products.set(name, existing);
    }
  }

  // A booking counts as revenue only once paid and not cancelled. Unpaid,
  // pending, refunded and cancelled bookings stay in the history for context.
  for (const bk of bookings) {
    const email = norm(bk.buyer?.email ?? bk.guestEmail);
    const phone = phoneNorm(bk.guestPhone ?? bk.buyer?.phone);
    const pk = phoneKey(phone);
    const profileId = (bk.buyerId ? profileByIdentity.get(`u:${bk.buyerId}`) : undefined) ?? profileByIdentity.get(email ? `e:${email}` : "") ?? (pk ? profileByIdentity.get(`p:${pk}`) : undefined) ?? null;
    const key = profileId ? `profile:${profileId}` : email ? `email:${email}` : pk ? `phone:${pk}` : bk.buyerId ? `user:${bk.buyerId}` : `booking:${bk.id}`;
    let b = buckets.get(key);
    if (!b) {
      const profile = profileId ? profileById.get(profileId) : undefined;
      b = { id: key, profileId, userId: profile?.userId ?? bk.buyerId ?? null, name: profile?.name ?? bk.buyer?.name ?? bk.guestName ?? "Customer", email, phone, notes: profile?.notes ?? null,
        orders: 0, spent: 0, onlineOrders: 0, posOrders: 0, lastPurchase: null, firstPurchase: null, ordersList: [], products: new Map(), bills: [], roomPaid: 0, roomOpen: 0, bookingCount: 0 };
      buckets.set(key, b);
    }
    const amount = Number(bk.paymentAmount ?? 0);
    const counts = bk.paymentStatus === "PAID" && bk.status !== "CANCELLED";
    const serviceName = bk.service?.name ?? "Booking";
    if (counts) {
      currenciesSeen.add(bk.paymentCurrency);
      b.orders += 1; b.spent += amount; b.bookingCount += 1;
      if (!b.lastPurchase || bk.createdAt > b.lastPurchase) b.lastPurchase = bk.createdAt;
      if (!b.firstPurchase || bk.createdAt < b.firstPurchase) b.firstPurchase = bk.createdAt;
      const existing = b.products.get(serviceName) ?? { name: serviceName, quantity: 0, revenue: 0 };
      existing.quantity += 1; existing.revenue += amount;
      b.products.set(serviceName, existing);
    }
    b.ordersList.push({
      id: bk.id, number: `#${(bk.referenceCode ?? bk.id.slice(-7)).toUpperCase()}`, total: amount, currency: bk.paymentCurrency,
      channel: "BOOKING", status: counts ? bk.status : bk.status === "CANCELLED" ? "CANCELLED" : bk.paymentStatus,
      createdAt: bk.createdAt.toISOString(), items: [serviceName],
    });
  }

  for (const guest of guests) {
    const email = norm(guest.email);
    const phone = phoneNorm(guest.phone);
    const pk = phoneKey(phone);
    // Deliberately no name-based fallback: two different guests can share a
    // name, and merging them would show one person's room charges on another's
    // profile. A guest with no email/phone stays their own row (guest:<id>).
    const profileId = profileByIdentity.get(email ? `e:${email}` : "") ?? (pk ? profileByIdentity.get(`p:${pk}`) : undefined) ?? null;
    const key = profileId ? `profile:${profileId}` : email ? `email:${email}` : pk ? `phone:${pk}` : `guest:${guest.id}`;
    let b = buckets.get(key);
    if (!b) { b = { id: key, profileId, userId: profileId ? profileById.get(profileId)?.userId ?? null : null, name: guest.fullName, email, phone, notes: guest.notes ?? null, orders: 0, spent: 0, onlineOrders: 0, posOrders: 0, lastPurchase: null, firstPurchase: null, ordersList: [], products: new Map(), bills: [], roomPaid: 0, roomOpen: 0, bookingCount: 0 }; buckets.set(key, b); }
    const totals = totalsByGuest.get(guest.id);
    if (totals) { b.roomPaid += totals.paid; b.roomOpen += totals.open; }
    for (const bill of guest.folioCharges) {
      b.bills.push({ id: bill.id, description: bill.description, category: bill.category, amount: Number(bill.amount), currency: bill.currency, status: bill.status, room: bill.reservation.room?.name ?? null, reservationId: bill.reservationId, postedAt: bill.postedAt.toISOString() });
    }
  }

  // Profiles without purchases are still useful CRM records and should be
  // visible so a merchant can message or create a first order for them.
  for (const p of profiles) {
    const key = `profile:${p.id}`;
    if (buckets.has(key)) continue;
    buckets.set(key, { id: key, profileId: p.id, userId: p.userId, name: p.name, email: norm(p.email), phone: phoneNorm(p.phone), notes: p.notes,
      orders: 0, spent: 0, onlineOrders: 0, posOrders: 0, lastPurchase: null, firstPurchase: null, ordersList: [], products: new Map(), bills: [], roomPaid: 0, roomOpen: 0, bookingCount: 0 });
  }

  const customers = [...buckets.values()]
    .map((b) => ({ id: b.id, name: b.name, email: b.email, phone: b.phone, profileId: b.profileId, userId: b.userId,
      orders: b.orders, spent: Math.round(b.spent * 100) / 100, averageOrder: b.orders ? Math.round((b.spent / b.orders) * 100) / 100 : 0,
      lastPurchase: b.lastPurchase?.toISOString() ?? null, firstPurchase: b.firstPurchase?.toISOString() ?? null,
      onlineOrders: b.onlineOrders, posOrders: b.posOrders, bookingCount: b.bookingCount, notes: b.notes,
      ordersList: [...b.ordersList].sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 20), topProducts: [...b.products.values()].sort((a,b) => b.revenue-a.revenue).slice(0,5).map((p) => ({ ...p, revenue: Math.round(p.revenue*100)/100 })), bills: [...b.bills].sort((x, y) => y.postedAt.localeCompare(x.postedAt)).slice(0, 30),
      roomChargesPaid: Math.round(b.roomPaid * 100) / 100, roomChargesOpen: Math.round(b.roomOpen * 100) / 100 }))
    .sort((a,b) => b.spent-a.spent || a.name.localeCompare(b.name));

  return { customers, sellsProducts, offersServices, walkIn: { orders: walkIn.orders, spent: Math.round(walkIn.spent * 100) / 100 },
    currency: storeCurrency, locale: access.store.locale ?? null,
    mixedCurrencies: findMixedCurrencies([storeCurrency, ...currenciesSeen]) };
}


/** Saves the merchant's private notes on a customer profile of this store. An empty note clears it. */
export async function saveCustomerNotes(slug: string, profileId: string, notes: string): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "customers");
  if (!access.success) return access;
  const clean = String(notes ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 2000);
  const res = await prisma.storeCustomerProfile.updateMany({ where: { id: profileId, storeId: access.store.id }, data: { notes: clean || null } });
  if (!res.count) return { success: false, error: "Customer not found." };
  revalidatePath(`/store/${slug}/admin/customers`);
  return { success: true, data: undefined };
}
