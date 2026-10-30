/**
 * Headline numbers for the Customer 360 stat cards.
 *
 * Average order is total spend / total orders. It must NOT be an average of
 * each customer's own average: that weights a one-order customer the same as
 * a fifty-order one, and profiles with no orders (every storefront signup
 * creates one) would drag it toward zero.
 */
export function summarizeCustomers(customers: { spent: number; orders: number }[]) {
  const lifetimeValue = customers.reduce((sum, c) => sum + c.spent, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.orders, 0);
  const repeatCount = customers.filter((c) => c.orders > 1).length;
  const averageOrder = totalOrders > 0 ? lifetimeValue / totalOrders : 0;
  return { lifetimeValue, totalOrders, repeatCount, averageOrder };
}
