"use client";

import { startCheckout } from "@/lib/actions/order";
import type { CartItem } from "@/lib/cart-context";

export type CheckoutAddress = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
};

/**
 * Shared client checkout gateway used by every storefront template.
 * Presentation components own their visuals; this module owns the handoff
 * to the authoritative server checkout engine.
 */
export async function submitCheckout(input: {
  slug: string;
  items: Pick<CartItem, "productId" | "quantity">[];
  deliveryZoneId?: string;
  shippingAddress: CheckoutAddress;
  idempotencyKey: string;
}) {
  return startCheckout(input.slug, {
    items: input.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    deliveryZoneId: input.deliveryZoneId,
    shippingAddress: input.shippingAddress,
    idempotencyKey: input.idempotencyKey,
  });
}
