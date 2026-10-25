"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import {
  firstTimeFor,
  registerTracking,
  trackEvent,
  trackPageView,
  type TrackItem,
} from "@/lib/tracking/client";

// useLayoutEffect warns during SSR; this resolves to a no-op there.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Mounted once in app/store/[slug]/layout.tsx when the store has at least one
 * tracking ID. Registers the store's IDs, loads the provider scripts and sends
 * a page view on first load and on every client-side navigation.
 *
 * Registration happens in a layout effect on purpose: React runs all layout
 * effects before any passive effects, so by the time a page's own
 * <TrackViewItem> effect runs the store is already registered.
 */
export function StoreTracking({
  slug,
  gaId,
  metaPixelId,
  plausibleDomain,
}: {
  slug: string;
  gaId: string | null;
  metaPixelId: string | null;
  plausibleDomain: string | null;
}) {
  useIsoLayoutEffect(
    () => registerTracking({ slug, gaId, metaPixelId, plausibleDomain }),
    [slug, gaId, metaPixelId, plausibleDomain]
  );

  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    // Wait a tick so document.title / location reflect the new route.
    const t = setTimeout(() => {
      trackPageView(slug, first.current);
      first.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, [pathname, slug, gaId, metaPixelId, plausibleDomain]);

  return null;
}

/** Product / service detail page view. */
export function TrackViewItem({ slug, item, currency }: { slug: string; item: TrackItem; currency: string }) {
  useEffect(() => {
    trackEvent(slug, { type: "view_item", currency, item });
    // Only re-fire when the viewed item changes, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, item.id]);
  return null;
}

/** Fires once per checkout visit, as soon as the buyer's cart for this store is loaded. */
export function TrackBeginCheckout({ slug }: { slug: string }) {
  const { items, storeSlug } = useCart();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || storeSlug !== slug || items.length === 0) return;
    fired.current = true;
    const currency = items[0].currency || "NGN";
    trackEvent(slug, {
      type: "begin_checkout",
      currency,
      value: items.reduce((s, i) => s + i.price * i.quantity, 0),
      items: items.map((i) => ({ id: i.productId, name: i.name, price: i.price, quantity: i.quantity, variant: i.variantLabel })),
    });
  }, [slug, storeSlug, items]);
  return null;
}

/** Order confirmation: one Purchase per order id, ever (per browser). */
export function TrackPurchase({
  slug,
  transactionId,
  currency,
  value,
  items,
}: {
  slug: string;
  transactionId: string;
  currency: string;
  value: number;
  items: TrackItem[];
}) {
  useEffect(() => {
    if (!firstTimeFor(`purchase:${slug}:${transactionId}`)) return;
    trackEvent(slug, { type: "purchase", currency, value, transactionId, items });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, transactionId]);
  return null;
}

/**
 * Booking confirmation. A paid booking is a Purchase; a booking that was
 * received but isn't paid online is reported as a lead/schedule request.
 */
export function TrackBooking({
  slug,
  bookingId,
  name,
  currency,
  value,
  paid,
}: {
  slug: string;
  bookingId: string;
  name: string;
  currency: string;
  value: number;
  paid: boolean;
}) {
  useEffect(() => {
    if (!firstTimeFor(`booking:${slug}:${bookingId}:${paid ? "paid" : "request"}`)) return;
    if (paid) {
      trackEvent(slug, { type: "purchase", currency, value, transactionId: bookingId, items: [{ id: bookingId, name, price: value, quantity: 1 }] });
    } else {
      trackEvent(slug, { type: "booking_request", currency, value, transactionId: bookingId, name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, bookingId, paid]);
  return null;
}
