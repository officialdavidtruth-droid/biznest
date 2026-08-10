"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { roundMoney } from "@/lib/utils/pricing";
import type { ActionResult } from "@/types/actions";
import type { Store, Business } from "@prisma/client";

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

async function assertStoreAccess(slug: string): Promise<StoreAccessResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false, error: "You don't have access to this store." };

  return { success: true, store };
}

export type PurchaseOrderLineInput = {
  productId?: string;
  variantId?: string;
  description: string;
  quantityOrdered: number;
  unitCost: number;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  currency?: string;
  notes?: string;
  expectedAt?: string; // ISO date
  items: PurchaseOrderLineInput[];
};

// --- Reads -------------------------------------------------------------

export async function listPurchaseOrders(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.purchaseOrder.findMany({
    where: { storeId: access.store.id },
    include: { supplier: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPurchaseOrder(slug: string, poId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;

  return prisma.purchaseOrder.findFirst({
    where: { id: poId, storeId: access.store.id },
    include: {
      supplier: true,
      items: { include: { product: true, variant: true } },
    },
  });
}

// --- Draft lifecycle -----------------------------------------------------

export async function createPurchaseOrder(
  slug: string,
  input: CreatePurchaseOrderInput
): Promise<ActionResult<{ purchaseOrderId: string; poNumber: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (!input.items.length) return { success: false, error: "Add at least one line item." };
  for (const line of input.items) {
    if (line.quantityOrdered <= 0) return { success: false, error: "Quantities must be greater than 0." };
    if (line.unitCost < 0) return { success: false, error: "Unit cost can't be negative." };
    if (!line.productId && !line.variantId) return { success: false, error: "Each line needs a product or variant." };
  }

  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, storeId: access.store.id } });
  if (!supplier) return { success: false, error: "Supplier not found." };

  const subtotal = roundMoney(input.items.reduce((sum, i) => sum + i.unitCost * i.quantityOrdered, 0));

  const po = await prisma.$transaction(async (tx) => {
    const store = await tx.store.update({
      where: { id: access.store.id },
      data: { nextPoNo: { increment: 1 } },
    });
    const poNumber = `${access.store.slug.slice(0, 12).toUpperCase()}-PO-${store.nextPoNo - 1}`;

    return tx.purchaseOrder.create({
      data: {
        poNumber,
        storeId: access.store.id,
        supplierId: input.supplierId,
        currency: input.currency || "NGN",
        subtotal,
        notes: input.notes?.trim() || null,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId || null,
            variantId: i.variantId || null,
            description: i.description,
            quantityOrdered: Math.round(i.quantityOrdered),
            unitCost: roundMoney(i.unitCost),
          })),
        },
      },
    });
  });

  revalidatePath(`/store/${slug}/admin/purchase-orders`);
  return { success: true, data: { purchaseOrderId: po.id, poNumber: po.poNumber } };
}

/** Replaces a draft PO's lines/notes/expected date wholesale. Draft only. */
export async function updatePurchaseOrder(
  slug: string,
  poId: string,
  input: Omit<CreatePurchaseOrderInput, "supplierId">
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, storeId: access.store.id } });
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status !== "DRAFT") return { success: false, error: "Only draft purchase orders can be edited." };

  if (!input.items.length) return { success: false, error: "Add at least one line item." };
  for (const line of input.items) {
    if (line.quantityOrdered <= 0) return { success: false, error: "Quantities must be greater than 0." };
    if (!line.productId && !line.variantId) return { success: false, error: "Each line needs a product or variant." };
  }

  const subtotal = roundMoney(input.items.reduce((sum, i) => sum + i.unitCost * i.quantityOrdered, 0));

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        subtotal,
        notes: input.notes?.trim() || null,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        currency: input.currency || po.currency,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId || null,
            variantId: i.variantId || null,
            description: i.description,
            quantityOrdered: Math.round(i.quantityOrdered),
            unitCost: roundMoney(i.unitCost),
          })),
        },
      },
    });
  });

  revalidatePath(`/store/${slug}/admin/purchase-orders/${poId}`);
  return { success: true, data: undefined };
}

export async function sendPurchaseOrder(slug: string, poId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, storeId: access.store.id } });
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status !== "DRAFT") return { success: false, error: "Only draft purchase orders can be sent." };

  await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "SENT", sentAt: new Date() } });

  revalidatePath(`/store/${slug}/admin/purchase-orders`);
  revalidatePath(`/store/${slug}/admin/purchase-orders/${poId}`);
  return { success: true, data: undefined };
}

export async function cancelPurchaseOrder(slug: string, poId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, storeId: access.store.id } });
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status === "RECEIVED") return { success: false, error: "A fully received purchase order can't be cancelled." };
  if (po.status === "CANCELLED") return { success: false, error: "Already cancelled." };

  await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "CANCELLED", cancelledAt: new Date() } });

  revalidatePath(`/store/${slug}/admin/purchase-orders`);
  revalidatePath(`/store/${slug}/admin/purchase-orders/${poId}`);
  return { success: true, data: undefined };
}

// --- Receiving -------------------------------------------------------------

export type ReceiveLineInput = { itemId: string; quantity: number };

/**
 * Records goods received against a sent (or partially received) PO. Each
 * line's received quantity increments the underlying product/variant stock
 * through the same ledgered path as adjustStock/adjustVariantStock
 * (RESTOCK movement, note references the PO number, auto-republish on
 * restock applies same as any other restock) -- all inside one transaction
 * so a partial failure never leaves stock and the PO's received counts out
 * of sync. Receiving less than the ordered quantity leaves the PO
 * PARTIALLY_RECEIVED so the remainder can be received later; receiving the
 * last of every line marks it RECEIVED.
 */
export async function receivePurchaseOrder(
  slug: string,
  poId: string,
  lines: ReceiveLineInput[]
): Promise<ActionResult<{ status: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, storeId: access.store.id },
    include: { items: true },
  });
  if (!po) return { success: false, error: "Purchase order not found." };
  if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
    return { success: false, error: "Only a sent purchase order can receive stock." };
  }

  const itemById = new Map(po.items.map((i) => [i.id, i]));
  const activeLines = lines.filter((l) => l.quantity > 0);
  if (activeLines.length === 0) return { success: false, error: "Enter a received quantity for at least one line." };

  for (const line of activeLines) {
    const item = itemById.get(line.itemId);
    if (!item) return { success: false, error: "Line item not found on this purchase order." };
    const remaining = item.quantityOrdered - item.quantityReceived;
    if (line.quantity > remaining) {
      return { success: false, error: `Can't receive more than the ${remaining} still outstanding for "${item.description}".` };
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const line of activeLines) {
      const item = itemById.get(line.itemId)!;
      const qty = Math.round(line.quantity);
      const note = `Received on ${po.poNumber}`;

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { quantityReceived: { increment: qty } },
      });

      if (item.variantId) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (!variant) continue;
        const nextQuantity = variant.quantity + qty;
        const justRestocked = variant.quantity === 0 && nextQuantity > 0;
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            quantity: nextQuantity,
            autoUnpublished: justRestocked ? false : variant.autoUnpublished,
            isActive: justRestocked ? true : variant.isActive,
          },
        });
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            storeId: access.store.id,
            type: "RESTOCK",
            quantityChange: qty,
            quantityAfter: nextQuantity,
            note,
          },
        });
      } else if (item.productId) {
        const inventoryItem = await tx.inventoryItem.findUnique({ where: { productId: item.productId } });
        if (!inventoryItem) continue;
        const nextQuantity = inventoryItem.quantity + qty;
        const justRestocked = inventoryItem.quantity === 0 && nextQuantity > 0;
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { quantity: nextQuantity, autoUnpublished: justRestocked ? false : inventoryItem.autoUnpublished },
        });
        if (justRestocked && inventoryItem.autoUnpublished) {
          await tx.product.update({ where: { id: item.productId }, data: { isPublished: true } });
        }
        await tx.stockMovement.create({
          data: {
            inventoryItemId: inventoryItem.id,
            storeId: access.store.id,
            type: "RESTOCK",
            quantityChange: qty,
            quantityAfter: nextQuantity,
            note,
          },
        });
      }
    }

    const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: poId } });
    const allReceived = refreshedItems.every((i) => i.quantityReceived >= i.quantityOrdered);
    const anyReceived = refreshedItems.some((i) => i.quantityReceived > 0);

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status,
        receivedAt: allReceived ? new Date() : po.receivedAt,
      },
    });
  });

  const updated = await prisma.purchaseOrder.findUnique({ where: { id: poId } });

  revalidatePath(`/store/${slug}/admin/purchase-orders`);
  revalidatePath(`/store/${slug}/admin/purchase-orders/${poId}`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { status: updated?.status ?? "RECEIVED" } };
}
