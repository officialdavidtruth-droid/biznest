import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { NextResponse } from "next/server";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";
import { reviewRequestWindow } from "@/lib/review-requests";
import { buildStoreUrl } from "@/lib/store-url";
import { sendReviewRequestEmail, storeEmailBrand } from "@/lib/email/send";
import { messageCustomer } from "@/lib/customer-messaging";
import { reviewRequestText } from "@/lib/customer-messages";

const BATCH = 200;

const storeSelect = {
  id: true, name: true, slug: true, logoUrl: true, themeColors: true, contactEmail: true, contactPhone: true,
  customDomain: true, customDomainStatus: true,
} as const;

/**
 * Asks customers for a review ~3 days after an order is delivered or a booking is completed, for stores that
 * switched on "Review requests" (Store.msgReviewRequests, off by default). Email when we have one, plus a
 * WhatsApp/SMS message when we have a phone. A customer gets ONE request per store per run no matter how many
 * orders qualified; every order/booking in that group is stamped so it is never asked about twice.
 * Daily schedule (Vercel Hobby allows nothing tighter); the window logic is in lib/review-requests.ts.
 */
export const GET = withCronMonitor("review-requests", async () => {
  const start = Date.now();
  const { notAfter, notBefore } = reviewRequestWindow();
  let asked = 0, failures = 0;

  type Target = {
    store: { id: string; name: string; slug: string; logoUrl: string | null; themeColors: unknown; contactEmail: string | null; contactPhone: string | null; customDomain: string | null; customDomainStatus: string };
    name: string | null; email: string | null; phone: string | null;
    kind: "order" | "booking"; orderIds: string[]; bookingIds: string[];
  };
  const targets = new Map<string, Target>();
  const add = (key: string, t: Omit<Target, "orderIds" | "bookingIds">, orderId?: string, bookingId?: string) => {
    const cur = targets.get(key) ?? { ...t, orderIds: [], bookingIds: [] };
    if (orderId) cur.orderIds.push(orderId);
    if (bookingId) cur.bookingIds.push(bookingId);
    targets.set(key, cur);
  };

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["DELIVERED", "COMPLETED"] },
      reviewRequestedAt: null,
      channel: { not: "POS" },
      store: { msgReviewRequests: true },
      statusEvents: { some: { status: { in: ["DELIVERED", "COMPLETED"] }, createdAt: { lte: notAfter, gte: notBefore } } },
    },
    select: { id: true, buyerId: true, shippingAddress: true, buyer: { select: { name: true, email: true } }, store: { select: storeSelect } },
    take: BATCH,
  });
  for (const o of orders) {
    const ship = o.shippingAddress as { fullName?: string; phone?: string } | null;
    add(`${o.store.id}:${o.buyerId}`, { store: o.store, name: ship?.fullName ?? o.buyer.name, email: o.buyer.email, phone: ship?.phone ?? null, kind: "order" }, o.id);
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      reviewRequestedAt: null,
      store: { msgReviewRequests: true },
      OR: [
        { checkOut: { lte: notAfter, gte: notBefore } },
        { checkOut: null, scheduledAt: { lte: notAfter, gte: notBefore } },
      ],
    },
    select: { id: true, buyerId: true, guestName: true, guestPhone: true, buyer: { select: { name: true, email: true } }, store: { select: storeSelect } },
    take: BATCH,
  });
  for (const b of bookings) {
    const who = b.buyerId ?? b.guestPhone ?? b.id;
    add(`${b.store.id}:${who}`, { store: b.store, name: b.buyer?.name ?? b.guestName, email: b.buyer?.email ?? null, phone: b.guestPhone, kind: "booking" }, undefined, b.id);
  }

  for (const t of targets.values()) {
    try {
      const reviewUrl = buildStoreUrl(t.store, "/account/reviews");
      let delivered = false;
      if (t.email) {
        const res = await sendReviewRequestEmail({ to: t.email, recipientName: t.name, brand: storeEmailBrand(t.store), reviewUrl, kind: t.kind });
        delivered = !res.error;
      }
      if (t.phone) {
        const out = await messageCustomer({
          phone: t.phone, firstName: t.name, storeName: t.store.name,
          text: reviewRequestText({ storeName: t.store.name, reviewUrl, kind: t.kind }),
          dedupeKey: `review:${t.store.id}:${t.email ?? t.phone}`, perHour: 2,
        });
        delivered = delivered || out.sent;
      }
      // Stamp when it went out, OR when there is nobody to reach (so we don't rescan them daily).
      // A transient failure leaves it unstamped and it is retried tomorrow, while still inside the window.
      if (delivered || (!t.email && !t.phone)) {
        const now = new Date();
        if (t.orderIds.length) await prisma.order.updateMany({ where: { id: { in: t.orderIds } }, data: { reviewRequestedAt: now } });
        if (t.bookingIds.length) await prisma.booking.updateMany({ where: { id: { in: t.bookingIds } }, data: { reviewRequestedAt: now } });
        if (delivered) asked++;
      } else {
        failures++;
      }
    } catch (err) {
      failures++;
      void logError("JOBS", "review-requests: send failed", errorMeta(err, { storeId: t.store.id }));
    }
  }

  void logInfo("JOBS", "review-requests completed", { candidates: targets.size, asked, failures }, Date.now() - start);
  return NextResponse.json({ candidates: targets.size, asked, failures });
});
