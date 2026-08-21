import { z } from "zod";

export const checkoutSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().cuid(), quantity: z.coerce.number().int().min(1) }))
    .min(1, "Your cart is empty"),
  deliveryZoneId: z.string().cuid().optional(),
  shippingAddress: z.object({
    fullName: z.string().min(2),
    phone: z.string().min(7),
    address: z.string().min(5),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
  }),
  // Generated once per checkout page load, client-side (see the
  // *-checkout-client.tsx components), and reused unchanged across every
  // submit attempt for that page load — including retries. Lets
  // startCheckout recognize "this is the same purchase attempt as before"
  // with certainty, rather than the heuristic same-cart guess it used to
  // fall back on, closing the window where two truly simultaneous
  // submissions could both create an order and both get charged.
  idempotencyKey: z.string().min(10).max(128),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
