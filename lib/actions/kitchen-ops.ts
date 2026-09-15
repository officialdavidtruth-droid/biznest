"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";

/**
 * Kitchen Operations is a separate, staff-facing plugin from BizNest FnB.
 * It gives service staff a lean workspace (POS, Orders, Tables, a read-only
 * Menu view, Customers, Reports) without exposing Inventory, Procurement,
 * Suppliers, Wastage, Recipes or Settings — those stay in the full FnB
 * workspace for owners/managers. Menu editing and pricing are never
 * reachable from here: the underlying product/category/variant/add-on
 * actions already reject STAFF at the server level regardless of which UI
 * calls them.
 */
async function access(slug: string) {
  const a = await assertStorePermission(slug, "plugin:restaurant-operations");
  if (!a.success) return a;
  if (!["Restaurant", "Food & Groceries"].includes(a.store.businessType)) {
    return { success: false as const, error: "Kitchen Operations is available to restaurant and food/grocery businesses." };
  }
  return a;
}

export async function getKitchenOpsDashboard(slug: string) {
  const a = await access(slug);
  if (!a.success) return null;
  const storeId = a.store.id;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);

  const [orders, reservations, products, customers] = await Promise.all([
    prisma.order.findMany({ where: { storeId, createdAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 40, select: { id: true, total: true, currency: true, status: true, channel: true, posCustomerName: true, createdAt: true, items: { select: { quantity: true, product: { select: { name: true } }, variant: { select: { label: true, product: { select: { name: true } } } } } } } }),
    prisma.booking.findMany({ where: { storeId, scheduledAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED"] } }, orderBy: { scheduledAt: "asc" }, take: 30, select: { id: true, scheduledAt: true, status: true, guestName: true, partySize: true } }),
    prisma.product.findMany({ where: { storeId, type: "PHYSICAL" }, select: { id: true, name: true, price: true, currency: true, images: true, inventory: { select: { quantity: true } } }, orderBy: { name: "asc" }, take: 200 }),
    prisma.storeCustomerProfile.findMany({ where: { storeId }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, name: true, email: true, phone: true, updatedAt: true } }),
  ]);

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const activeOrders = orders.filter((o) => ["PAID", "IN_PROGRESS"].includes(o.status)).length;
  const completedOrders = orders.filter((o) => ["DELIVERED", "COMPLETED"].includes(o.status)).length;
  const plainOrders = orders.map((o) => ({ ...o, total: Number(o.total) }));
  const plainProducts = products.map((p) => ({ ...p, price: Number(p.price) }));

  return {
    storeName: a.store.name,
    role: a.role,
    orders: plainOrders,
    reservations,
    products: plainProducts,
    customers,
    metrics: { revenue, activeOrders, completedOrders, ordersToday: orders.length, reservationsToday: reservations.length },
  };
}

export async function advanceKitchenOrderStatus(slug: string, orderId: string, status: "IN_PROGRESS" | "DELIVERED" | "COMPLETED"): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId: a.store.id }, select: { id: true, status: true } });
  if (!order) return { success: false, error: "Order not found." };
  const allowed: Record<string, string[]> = { PAID: ["IN_PROGRESS"], IN_PROGRESS: ["DELIVERED"], DELIVERED: ["COMPLETED"] };
  if (!allowed[order.status]?.includes(status)) return { success: false, error: `Cannot move ${order.status} to ${status}.` };
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status, escrowReleasedAt: status === "COMPLETED" ? new Date() : undefined } });
    await tx.orderStatusEvent.create({ data: { orderId: order.id, status } });
  });
  revalidatePath(`/store/${slug}/admin/kitchen-ops`);
  revalidatePath(`/store/${slug}/admin/orders`);
  return { success: true, data: undefined };
}
