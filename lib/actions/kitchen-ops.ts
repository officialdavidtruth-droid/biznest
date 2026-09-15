"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { consumeFifoStockTx, consumeFefoStockTx } from "@/lib/inventory-fifo";
import { getFnbRotationMode, type FnbRotationMode } from "@/lib/fnb-settings";
import { extractFnbRecipe } from "@/lib/fnb-utils";
import type { ActionResult } from "@/types/actions";

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
  const now = new Date();
  const seven = new Date(now); seven.setDate(seven.getDate() + 7);
  const session = await auth();
  const shiftHistoryWhere = a.role === "STAFF" && session?.user?.id ? { storeId, staffUserId: session.user.id } : { storeId };

  const [orders, reservations, products, inventory, batches, purchaseOrders, suppliers, customers, wasteMovements, currentShift, recentShifts] = await Promise.all([
    prisma.order.findMany({ where: { storeId, createdAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, total: true, currency: true, status: true, channel: true, posCustomerName: true, createdAt: true, items: { select: { quantity: true, product: { select: { name: true } }, variant: { select: { label: true, product: { select: { name: true } } } } } } } }),
    prisma.booking.findMany({ where: { storeId, scheduledAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED"] } }, orderBy: { scheduledAt: "asc" }, take: 50, select: { id: true, scheduledAt: true, status: true, guestName: true, partySize: true } }),
    prisma.product.findMany({ where: { storeId, type: "PHYSICAL" }, select: { id: true, name: true, price: true, currency: true, images: true, attributes: true, isPublished: true, inventory: { select: { id: true, quantity: true, lowStockThreshold: true, costPrice: true } } }, orderBy: { name: "asc" }, take: 300 }),
    prisma.inventoryItem.findMany({ where: { storeId }, select: { id: true, productId: true, quantity: true, lowStockThreshold: true, costPrice: true, product: { select: { name: true, price: true, currency: true, isPublished: true } } }, orderBy: { product: { name: "asc" } } }),
    prisma.inventoryBatch.findMany({ where: { storeId, quantityRemaining: { gt: 0 } }, orderBy: [{ receivedAt: "asc" }, { id: "asc" }], take: 300, select: { id: true, batchNumber: true, quantityReceived: true, quantityRemaining: true, unitCost: true, receivedAt: true, expiryDate: true, inventoryItem: { select: { id: true, product: { select: { name: true } } } }, variant: { select: { label: true, product: { select: { name: true } } } } } }),
    prisma.purchaseOrder.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, poNumber: true, status: true, subtotal: true, currency: true, supplier: { select: { name: true } }, items: { select: { quantityOrdered: true, quantityReceived: true } } } }),
    prisma.supplier.findMany({ where: { storeId, isArchived: false }, orderBy: { name: "asc" }, take: 200, select: { id: true, name: true, contactName: true, phone: true, email: true } }),
    prisma.storeCustomerProfile.findMany({ where: { storeId }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, name: true, email: true, phone: true, updatedAt: true } }),
    prisma.stockMovement.findMany({ where: { storeId, type: "MANUAL_ADJUSTMENT", note: { startsWith: "FNB WASTE:" } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, quantityChange: true, quantityAfter: true, note: true, createdAt: true, inventoryItem: { select: { product: { select: { name: true } } } } } }),
    session?.user?.id ? prisma.fnbShift.findFirst({ where: { storeId, staffUserId: session.user.id, status: "OPEN" }, orderBy: { startedAt: "desc" }, select: { id: true, status: true, startedAt: true, endedAt: true, salesCount: true, salesTotal: true } }) : Promise.resolve(null),
    prisma.fnbShift.findMany({ where: shiftHistoryWhere, orderBy: { startedAt: "desc" }, take: 20, select: { id: true, status: true, startedAt: true, endedAt: true, salesCount: true, salesTotal: true, staffUser: { select: { id: true, name: true, email: true } } } }),
  ]);

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const activeOrders = orders.filter((o) => ["PAID", "IN_PROGRESS"].includes(o.status)).length;
  const completedOrders = orders.filter((o) => ["DELIVERED", "COMPLETED"].includes(o.status)).length;
  const stockValue = inventory.reduce((sum, i) => sum + (i.costPrice == null ? 0 : Number(i.costPrice) * i.quantity), 0);
  const lowStock = inventory.filter((i) => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const outOfStock = inventory.filter((i) => i.quantity === 0).length;
  const expiringSoon = batches.filter((b) => b.expiryDate && b.expiryDate >= now && b.expiryDate <= seven).length;
  const expired = batches.filter((b) => b.expiryDate && b.expiryDate < now).length;
  const batchValue = batches.reduce((sum, b) => sum + (b.unitCost == null ? 0 : Number(b.unitCost) * b.quantityRemaining), 0);
  const recipeCount = products.filter((p) => extractFnbRecipe(p.attributes)).length;
  const wasteUnits = wasteMovements.reduce((sum, m) => sum + Math.abs(m.quantityChange), 0);
  const mode = getFnbRotationMode(a.store.enabledModules);

  return {
    storeName: a.store.name,
    role: a.role,
    mode,
    orders: orders.map((o) => ({ ...o, total: Number(o.total) })),
    reservations,
    products: products.map((p) => ({ ...p, price: Number(p.price), inventory: p.inventory ? { ...p.inventory, costPrice: p.inventory.costPrice == null ? null : Number(p.inventory.costPrice) } : null })),
    inventory: inventory.map((i) => ({ ...i, costPrice: i.costPrice == null ? null : Number(i.costPrice), product: { ...i.product, price: Number(i.product.price) } })),
    batches: batches.map((b) => ({ ...b, unitCost: b.unitCost == null ? null : Number(b.unitCost) })),
    purchaseOrders: purchaseOrders.map((po) => ({ ...po, subtotal: Number(po.subtotal) })),
    suppliers,
    customers,
    wasteMovements,
    currentShift: currentShift ? { ...currentShift, salesTotal: Number(currentShift.salesTotal) } : null,
    recentShifts: recentShifts.map((shift) => ({ ...shift, salesTotal: Number(shift.salesTotal) })),
    metrics: { revenue, activeOrders, completedOrders, ordersToday: orders.length, reservationsToday: reservations.length, stockValue, lowStock, outOfStock, expiringSoon, expired, batchValue, recipeCount, wasteUnits },
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

export async function startKitchenShift(slug: string): Promise<ActionResult<{ id: string; startedAt: Date }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "You must be signed in." };
  try {
    const shift = await prisma.fnbShift.create({ data: { storeId: a.store.id, staffUserId: userId } });
    revalidatePath(`/store/${slug}/admin/kitchen-ops`);
    return { success: true, data: { id: shift.id, startedAt: shift.startedAt } };
  } catch (err: any) {
    if (err?.code === "P2002") return { success: false, error: "You already have an open shift. End it before starting another." };
    throw err;
  }
}

export async function endKitchenShift(slug: string): Promise<ActionResult<{ id: string; endedAt: Date; salesCount: number; salesTotal: number }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "You must be signed in." };
  const shift = await prisma.fnbShift.findFirst({ where: { storeId: a.store.id, staffUserId: userId, status: "OPEN" }, select: { id: true } });
  if (!shift) return { success: false, error: "You do not have an open shift." };
  const endedAt = new Date();
  const sales = await prisma.order.aggregate({ where: { storeId: a.store.id, fnbShiftId: shift.id, channel: "POS", status: { notIn: ["CANCELLED", "REFUNDED"] } }, _count: { _all: true }, _sum: { total: true } });
  const result = await prisma.fnbShift.updateMany({ where: { id: shift.id, storeId: a.store.id, staffUserId: userId, status: "OPEN" }, data: { status: "CLOSED", endedAt, salesCount: sales._count._all, salesTotal: sales._sum.total ?? 0 } });
  if (result.count === 0) return { success: false, error: "This shift was already closed." };
  revalidatePath(`/store/${slug}/admin/kitchen-ops`);
  return { success: true, data: { id: shift.id, endedAt, salesCount: sales._count._all, salesTotal: Number(sales._sum.total ?? 0) } };
}

export async function setKitchenRotationMode(slug: string, mode: FnbRotationMode): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  if (a.role === "STAFF") return { success: false, error: "Only the store owner or manager can change stock rotation." };
  const current = a.store.enabledModules && typeof a.store.enabledModules === "object" && !Array.isArray(a.store.enabledModules) ? a.store.enabledModules as Record<string, unknown> : {};
  await prisma.store.update({ where: { id: a.store.id }, data: { enabledModules: { ...current, fnbRotationMode: mode } } });
  revalidatePath(`/store/${slug}/admin/kitchen-ops`);
  return { success: true, data: undefined };
}

export async function saveKitchenRecipe(slug: string, productId: string, recipe: { yieldQty: number; ingredients: Array<{ inventoryItemId: string; quantity: number; unit: string }> }): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  if (a.role === "STAFF") return { success: false, error: "Only the store owner or manager can edit recipes and food cost." };
  if (!Number.isFinite(recipe.yieldQty) || recipe.yieldQty <= 0) return { success: false, error: "Recipe yield must be greater than zero." };
  const product = await prisma.product.findFirst({ where: { id: productId, storeId: a.store.id }, select: { id: true, attributes: true } });
  if (!product) return { success: false, error: "Menu item not found." };
  const ids = recipe.ingredients.map((i) => i.inventoryItemId).filter(Boolean);
  const inventory = await prisma.inventoryItem.findMany({ where: { id: { in: ids }, storeId: a.store.id }, include: { product: { select: { name: true } } } });
  if (inventory.length !== ids.length) return { success: false, error: "One or more ingredients do not belong to this store." };
  const names = new Map(inventory.map((i) => [i.id, i.product.name]));
  const clean = recipe.ingredients.filter((i) => i.inventoryItemId && Number(i.quantity) > 0).map((i) => ({ inventoryItemId: i.inventoryItemId, quantity: Number(i.quantity), unit: i.unit.trim() || "unit", name: names.get(i.inventoryItemId) || "Ingredient" }));
  const current = product.attributes && typeof product.attributes === "object" && !Array.isArray(product.attributes) ? product.attributes as Record<string, unknown> : {};
  await prisma.product.update({ where: { id: product.id }, data: { attributes: { ...current, fnbRecipe: { yieldQty: recipe.yieldQty, ingredients: clean } } } });
  revalidatePath(`/store/${slug}/admin/kitchen-ops`);
  return { success: true, data: undefined };
}

export async function recordKitchenWaste(slug: string, inventoryItemId: string, quantity: number, reason: string): Promise<ActionResult<{ quantity: number }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  if (!Number.isInteger(quantity) || quantity <= 0) return { success: false, error: "Waste quantity must be a positive whole number." };
  const cleanReason = reason.trim().slice(0, 240);
  if (!cleanReason) return { success: false, error: "Enter a reason for the waste." };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, storeId: a.store.id }, include: { product: true } });
      if (!item) throw new Error("Inventory item not found.");
      if (item.quantity < quantity) throw new Error("Waste quantity cannot exceed stock on hand.");
      const next = item.quantity - quantity;
      const movement = await tx.stockMovement.create({ data: { inventoryItemId: item.id, storeId: a.store.id, type: "MANUAL_ADJUSTMENT", quantityChange: -quantity, quantityAfter: next, note: `FNB WASTE: ${cleanReason}` } });
      await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: next, autoUnpublished: next === 0 ? true : item.autoUnpublished } });
      const mode = getFnbRotationMode(a.store.enabledModules);
      const consume = mode === "FEFO" ? consumeFefoStockTx : consumeFifoStockTx;
      await consume(tx, { inventoryItemId: item.id, storeId: a.store.id, quantity, stockMovementId: movement.id });
      if (next === 0) await tx.product.update({ where: { id: item.productId }, data: { isPublished: false } });
      return next;
    }, { isolationLevel: "Serializable", timeout: 15000 });
    revalidatePath(`/store/${slug}/admin/kitchen-ops`);
    revalidatePath(`/store/${slug}/admin/inventory`);
    return { success: true, data: { quantity: result } };
  } catch (err: any) {
    return { success: false, error: err?.message || "Couldn't record waste safely." };
  }
}
