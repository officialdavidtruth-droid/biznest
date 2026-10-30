/**
 * Where a customer should land once a bank-transfer payment is confirmed.
 * Orders and bookings have their own confirmation pages; invoices, quote
 * deposits and PMS deposits have no public one (the invoice/quote pages need
 * a sign-in or signed link), so they stay on the pay page, which then shows
 * "Payment confirmed" (null here).
 */
export function confirmationPath(
  slug: string,
  p: { purpose: string; orderId?: string | null; bookingId?: string | null }
): string | null {
  if (p.purpose === "ORDER" && p.orderId) return `/store/${slug}/orders/${p.orderId}/confirmation`;
  if (p.purpose === "SERVICE_BOOKING" && p.bookingId) return `/store/${slug}/booking/${p.bookingId}/confirmation`;
  return null;
}
