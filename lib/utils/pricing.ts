/**
 * Pure order-total math, extracted out of lib/actions/order.ts so it can be
 * unit tested without a database. Nothing in this file touches Prisma,
 * auth, or the network — nothing here should ever need mocking beyond
 * plain numbers in and numbers out.
 */

export interface OrderLineInput {
  unitPrice: number;
  quantity: number;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  commission: number;
  total: number;
}

/**
 * Rounds to 2 decimal places using the same "cents-safe" approach as the
 * rest of the codebase (Math.round on a x100 value), since these numbers
 * eventually get written into Decimal(12,2) columns.
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateSubtotal(lines: OrderLineInput[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
}

/**
 * Commission is always calculated on product subtotal only, never on
 * delivery fee — delivery is a pass-through cost to the vendor, not
 * platform revenue. See README round 4 ("Delivery zones") for why this
 * split matters.
 */
export function calculateOrderTotals(
  lines: OrderLineInput[],
  deliveryFee: number,
  commissionRatePercent: number
): OrderTotals {
  const subtotal = calculateSubtotal(lines);
  const fee = roundMoney(Math.max(0, deliveryFee));
  const commission = roundMoney(subtotal * (commissionRatePercent / 100));
  const total = roundMoney(subtotal + fee);

  return { subtotal, deliveryFee: fee, commission, total };
}
