"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { consumeFifoStockTx, consumeFefoStockTx } from "@/lib/inventory-fifo";
import { getFnbRotationMode, type FnbRotationMode } from "@/lib/fnb-settings";
import type { ActionResult } from "@/types/actions";
import { extractFnbRecipe } from "@/lib/fnb-utils";

async function access(slug: string) {
  const a = await assertStorePermission(slug, "plugin:fnb-operations");
  if (!a.success) return a;
  if (!["Restaurant", "Food & Groceries"].includes(a.store.businessType)) {
    return { success: false as const, error: "BizNest FnB is available to restaurant and food/grocery businesses." };
  }
  return a;
}


export async function getFnbDashboard(slug: string) {
  const a = await access(slug);
  if (!a.success) return null;
  const storeId = a.store.id;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const now = new Date();
  const seven = new Date(now); seven.setDate(seven.getDate() + 7);

  const [orders, reservations, inventory, products, batches, purchaseOrders, suppliers, customers, wasteMovements] = await Promise.all([
    prisma.order.findMany({ where: { storeId, createdAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, total: true, currency: true, status: true, channel: true, posCustomerName: true, createdAt: true, items: { select: { quantity: true, product: { select: { name: true } }, variant: { select: { label: true, product: { select: { name: true } } } } } } } }),
    prisma.booking.count({ where: { storeId, scheduledAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED"] } } }),
    prisma.inventoryItem.findMany({ where: { storeId }, select: { id: true, productId: true, quantity: true, lowStockThreshold: true, costPrice: true, product: { select: { name: true, price: true, currency: true, isPublished: true, attributes: true } } }, orderBy: { product: { name: "asc" } } }),
    prisma.product.findMany({ where: { storeId, type: "PHYSICAL" }, select: { id: true, name: true, price: true, currency: true, images: true, attributes: true, inventory: { select: { id: true, quantity: true, costPrice: true } } }, orderBy: { name: "asc" }, take: 200 }),
    prisma.inventoryBatch.findMany({ where: { storeId, quantityRemaining: { gt: 0 } }, orderBy: [{ receivedAt: "asc" }, { id: "asc" }], take: 200, select: { id: true, batchNumber: true, quantityReceived: true, quantityRemaining: true, unitCost: true, receivedAt: true, expiryDate: true, inventoryItem: { select: { product: { select: { name: true } } } }, variant: { select: { label: true, product: { select: { name: true } } } } } }),
    prisma.purchaseOrder.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, poNumber: true, status: true, subtotal: true, currency: true, supplier: { select: { name: true } }, items: { select: { quantityOrdered: true, quantityReceived: true } } } }),
    prisma.supplier.findMany({ where: { storeId, isArchived: false }, orderBy: { name: "asc" }, take: 100, select: { id: true, name: true, contactName: true, phone: true, email: true } }),
    prisma.storeCustomerProfile.findMany({ where: { storeId }, orderBy: { updatedAt: "desc" }, take: 12, select: { id: true, name: true, email: true, phone: true, updatedAt: true } }),
    prisma.stockMovement.findMany({ where: { storeId, type: "MANUAL_ADJUSTMENT", note: { startsWith: "FNB WASTE:" } }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, quantityChange: true, quantityAfter: true, note: true, createdAt: true, inventoryItem: { select: { product: { select: { name: true } } } } } }),
  ]);

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const stockValue = inventory.reduce((sum, i) => sum + (i.costPrice == null ? 0 : Number(i.costPrice) * i.quantity), 0);
  const lowStock = inventory.filter((i) => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const outOfStock = inventory.filter((i) => i.quantity === 0).length;
  const expiringSoon = batches.filter((b) => b.expiryDate && b.expiryDate >= now && b.expiryDate <= seven).length;
  const expired = batches.filter((b) => b.expiryDate && b.expiryDate < now).length;
  const batchValue = batches.reduce((sum, b) => sum + (b.unitCost == null ? 0 : Number(b.unitCost) * b.quantityRemaining), 0);
  const activeOrders = orders.filter((o) => ["PAID", "IN_PROGRESS", "DELIVERED"].includes(o.status)).length;
  const recipeCount = products.filter((p) => extractFnbRecipe(p.attributes)).length;
  const wasteUnits = wasteMovements.reduce((sum, m) => sum + Math.abs(m.quantityChange), 0);
  const mode = getFnbRotationMode(a.store.enabledModules);
  const plainOrders = orders.map((o) => ({ ...o, total: Number(o.total) }));
  const plainInventory = inventory.map((i) => ({ ...i, costPrice: i.costPrice == null ? null : Number(i.costPrice), product: { ...i.product, price: Number(i.product.price) } }));
  const plainProducts = products.map((p) => ({ ...p, price: Number(p.price), inventory: p.inventory ? { ...p.inventory, costPrice: p.inventory.costPrice == null ? null : Number(p.inventory.costPrice) } : null }));
  const plainBatches = batches.map((b) => ({ ...b, unitCost: b.unitCost == null ? null : Number(b.unitCost) }));
  const plainPurchaseOrders = purchaseOrders.map((po) => ({ ...po, subtotal: Number(po.subtotal) }));

  return {
    storeName: a.store.name, mode, orders: plainOrders, reservations, inventory: plainInventory, products: plainProducts, batches: plainBatches, purchaseOrders: plainPurchaseOrders, suppliers, customers, wasteMovements,
    metrics: { revenue, stockValue, lowStock, outOfStock, expiringSoon, expired, batchValue, activeOrders, recipeCount, wasteUnits },
  };
}

export async function updateFnbKitchenOrderStatus(slug: string, orderId: string, status: "IN_PROGRESS" | "DELIVERED" | "COMPLETED"): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId: a.store.id }, select: { id: true, status: true } });
  if (!order) return { success: false, error: "Kitchen order not found." };
  const allowed: Record<string, string[]> = { PAID: ["IN_PROGRESS"], IN_PROGRESS: ["DELIVERED"], DELIVERED: ["COMPLETED"] };
  if (!allowed[order.status]?.includes(status)) return { success: false, error: `Cannot move ${order.status} to ${status}.` };
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status, escrowReleasedAt: status === "COMPLETED" ? new Date() : undefined } });
    await tx.orderStatusEvent.create({ data: { orderId: order.id, status } });
  });
  revalidatePath(`/store/${slug}/admin/fnb`);
  revalidatePath(`/store/${slug}/admin/orders`);
  return { success: true, data: undefined };
}

export async function setFnbRotationMode(slug: string, mode: FnbRotationMode): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const current = a.store.enabledModules && typeof a.store.enabledModules === "object" && !Array.isArray(a.store.enabledModules) ? a.store.enabledModules as Record<string, unknown> : {};
  await prisma.store.update({ where: { id: a.store.id }, data: { enabledModules: { ...current, fnbRotationMode: mode } } });
  revalidatePath(`/store/${slug}/admin/fnb`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

export async function saveFnbRecipe(slug: string, productId: string, recipe: { yieldQty: number; ingredients: Array<{ inventoryItemId: string; quantity: number; unit: string }> }): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
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
  revalidatePath(`/store/${slug}/admin/fnb`);
  return { success: true, data: undefined };
}

export async function recordFnbWaste(slug: string, inventoryItemId: string, quantity: number, reason: string): Promise<ActionResult<{ quantity: number }>> {
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
      await consumeFifoStockTx(tx, { inventoryItemId: item.id, storeId: a.store.id, quantity, stockMovementId: movement.id });
      if (next === 0) await tx.product.update({ where: { id: item.productId }, data: { isPublished: false } });
      return next;
    }, { isolationLevel: "Serializable", timeout: 15000 });
    revalidatePath(`/store/${slug}/admin/fnb`);
    revalidatePath(`/store/${slug}/admin/inventory`);
    return { success: true, data: { quantity: result } };
  } catch (err: any) {
    return { success: false, error: err?.message || "Couldn't record waste safely." };
  }
}
