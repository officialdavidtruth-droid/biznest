"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { calculateOrderTotals, roundMoney } from "@/lib/utils/pricing";
import { posSaleSchema, type PosSaleInput } from "@/lib/validations/pos";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/actions/activity";
import type { ActionResult } from "@/types/actions";
import type { Store, Business } from "@prisma/client";

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

/**
 * Thrown inside a $transaction in this file to abort it with a specific,
 * user-facing message (e.g. "not enough stock", "more than what's owed")
 * -- caught right outside the $transaction call and turned into a normal
 * ActionResult failure. Any other thrown error is left to propagate/
 * rollback as a real 500. Shared by createPosSale and
 * recordPosCommissionSettlement below; not POS-sale-specific despite the
 * name's history.
 */
class PosTransactionError extends Error {}

/**
 * "pos" permission — a staff member can be given register access without
 * also getting the broader "Products & inventory"/"Orders" checkboxes, so
 * this checks its own permission id rather than delegating to those.
 */
async function assertStoreAccess(slug: string): Promise<StoreAccessResult> {
  const result = await assertStorePermission(slug, "pos");
  if (!result.success) return result;
  return { success: true, store: result.store };
}

// --- Catalog (the register's product grid) ------------------------------

export type PosCatalogVariant = {
  id: string;
  label: string;
  price: number; // resolved: variant override or parent product price
  sku: string | null;
  barcode: string | null;
  quantity: number;
};

export type PosCatalogItem = {
  kind: "product" | "service";
  id: string;
  name: string;
  image: string | null;
  price: number; // base price; ignored client-side once a variant is picked
  currency: string;
  sku: string | null;
  barcode: string | null;
  // null = stock isn't tracked for this item (services, or a product with
  // no InventoryItem yet) -- the register never blocks a sale on it.
  quantity: number | null;
  hasVariants: boolean;
  variants: PosCatalogVariant[];
};

/**
 * Everything sellable from the register: every product (regardless of
 * isPublished — a merchant may sell something in person that isn't listed
 * on the storefront, e.g. a wholesale-only or one-off item) plus every
 * service. Deliberately not paginated; a single store's catalog is small
 * enough for the register to hold client-side and filter/search instantly
 * rather than round-tripping the server per keystroke.
 */
export async function getPosCatalog(slug: string): Promise<PosCatalogItem[]> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  const [products, services] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: access.store.id, type: "PHYSICAL" },
      include: { inventory: true, variants: { where: { isActive: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { storeId: access.store.id },
      orderBy: { name: "asc" },
    }),
  ]);

  const productItems: PosCatalogItem[] = products.map((p) => ({
    kind: "product",
    id: p.id,
    name: p.name,
    image: p.images[0] ?? null,
    price: Number(p.price),
    currency: p.currency,
    sku: p.inventory?.sku ?? null,
    barcode: p.inventory?.barcode ?? null,
    quantity: p.hasVariants ? null : p.inventory?.quantity ?? null,
    hasVariants: p.hasVariants,
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price !== null ? Number(v.price) : Number(p.price),
      sku: v.sku,
      barcode: v.barcode,
      quantity: v.quantity,
    })),
  }));

  const serviceItems: PosCatalogItem[] = services.map((s) => ({
    kind: "service",
    id: s.id,
    name: s.name,
    image: s.images[0] ?? null,
    price: Number(s.price),
    currency: s.currency,
    sku: null,
    barcode: null,
    quantity: null,
    hasVariants: false,
    variants: [],
  }));

  return [...productItems, ...serviceItems];
}

export type PosBarcodeMatch =
  | { success: true; productId: string; variantId: string | null; name: string; price: number }
  | { success: false; error: string };

/** Quick-add lookup for a barcode scan/entry at the register. */
export async function lookupPosBarcode(slug: string, barcode: string): Promise<PosBarcodeMatch> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const code = barcode.trim();
  if (!code) return { success: false, error: "Scan or enter a barcode." };

  const variant = await prisma.productVariant.findFirst({
    where: { storeId: access.store.id, barcode: code, isActive: true },
    include: { product: true },
  });
  if (variant) {
    return {
      success: true,
      productId: variant.productId,
      variantId: variant.id,
      name: `${variant.product.name} — ${variant.label}`,
      price: variant.price !== null ? Number(variant.price) : Number(variant.product.price),
    };
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { storeId: access.store.id, barcode: code },
    include: { product: true },
  });
  if (item) {
    return {
      success: true,
      productId: item.productId,
      variantId: null,
      name: item.product.name,
      price: Number(item.product.price),
    };
  }

  return { success: false, error: "No product matches that barcode." };
}

export type PosCustomerMatch = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  orders: number;
  spent: number;
};

/** Store-scoped customer lookup for the register. It searches persistent POS
 * profiles first, then registered buyers who have actually purchased from the
 * store. It never exposes another store's customer data. */
export async function searchPosCustomers(slug: string, query: string): Promise<PosCustomerMatch[]> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const [profiles, orders] = await Promise.all([
    prisma.storeCustomerProfile.findMany({
      where: {
        storeId: access.store.id,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, name: true, email: true, phone: true },
      take: 8,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        storeId: access.store.id,
        status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] },
        OR: [
          { buyer: { name: { contains: q, mode: "insensitive" } } },
          { buyer: { email: { contains: q, mode: "insensitive" } } },
          { posCustomerName: { contains: q, mode: "insensitive" } },
          { posCustomerPhone: { contains: q } },
        ],
      },
      select: { buyerId: true, posCustomerName: true, posCustomerPhone: true, total: true, buyer: { select: { name: true, email: true, phone: true } } },
      take: 40,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const results = new Map<string, PosCustomerMatch>();
  for (const p of profiles) results.set(p.id, { ...p, orders: 0, spent: 0 });
  for (const o of orders) {
    const key = `user:${o.buyerId}`;
    const existing = results.get(key);
    if (existing) {
      existing.orders += 1;
      existing.spent += Number(o.total);
    } else {
      results.set(key, {
        id: o.buyerId,
        name: o.posCustomerName || o.buyer.name || "Customer",
        email: o.buyer.email ?? null,
        phone: o.posCustomerPhone || o.buyer.phone || null,
        orders: 1,
        spent: Number(o.total),
      });
    }
  }
  return [...results.values()].sort((a, b) => b.spent - a.spent).slice(0, 12);
}

// --- Checkout (the register's "Charge" button) ---------------------------

/**
 * Every POS sale is attributed to one shared "walk-in" User per store so
 * Order.buyerId (required) always has somewhere to point, without forcing
 * the cashier to create a real account for someone buying a bag of rice.
 * A named/phoned customer typed in at the register is still captured, just
 * on Order.posCustomerName/posCustomerPhone rather than the buyer relation.
 */
async function getOrCreateWalkInCustomer(storeId: string) {
  const email = `pos-walkin-${storeId}@biznest.internal`;
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Walk-in customer", role: "CUSTOMER" },
  });
}

export async function createPosSale(
  slug: string,
  input: PosSaleInput
): Promise<ActionResult<{ orderId: string; total: number }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const parsed = posSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid sale." };
  }
  const data = parsed.data;

  for (const line of data.items) {
    const targets = [line.productId, line.variantId, line.serviceId].filter(Boolean);
    if (targets.length !== 1) {
      return { success: false, error: "Each line must reference exactly one product, variant, or service." };
    }
  }

  const store = await prisma.store.findUnique({
    where: { id: access.store.id },
    include: { subscription: true },
  });
  if (!store) return { success: false, error: "Store not found." };

  const productIds = data.items.filter((i) => i.productId && !i.variantId).map((i) => i.productId!);
  const variantIds = data.items.filter((i) => i.variantId).map((i) => i.variantId!);
  const serviceIds = data.items.filter((i) => i.serviceId).map((i) => i.serviceId!);

  const [products, variants, services] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds }, storeId: store.id }, include: { inventory: true } })
      : Promise.resolve([]),
    variantIds.length
      ? prisma.productVariant.findMany({ where: { id: { in: variantIds }, storeId: store.id }, include: { product: true } })
      : Promise.resolve([]),
    serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: serviceIds }, storeId: store.id } })
      : Promise.resolve([]),
  ]);

  type ResolvedLine = {
    productId?: string;
    variantId?: string;
    serviceId?: string;
    quantity: number;
    unitPrice: number;
    name: string;
  };
  const resolved: ResolvedLine[] = [];
  let currency = "NGN";

  for (const line of data.items) {
    if (line.variantId) {
      const variant = variants.find((v) => v.id === line.variantId);
      if (!variant) return { success: false, error: "One of the items in this sale no longer exists." };
      if (variant.quantity < line.quantity) {
        return { success: false, error: `Not enough stock for ${variant.product.name} — ${variant.label}.` };
      }
      currency = variant.product.currency;
      resolved.push({
        variantId: variant.id,
        productId: variant.productId,
        quantity: line.quantity,
        unitPrice: variant.price !== null ? Number(variant.price) : Number(variant.product.price),
        name: `${variant.product.name} — ${variant.label}`,
      });
    } else if (line.productId) {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return { success: false, error: "One of the items in this sale no longer exists." };
      if (product.inventory && product.inventory.quantity < line.quantity) {
        return { success: false, error: `Not enough stock for ${product.name}.` };
      }
      currency = product.currency;
      resolved.push({
        productId: product.id,
        quantity: line.quantity,
        unitPrice: Number(product.price),
        name: product.name,
      });
    } else if (line.serviceId) {
      const service = services.find((s) => s.id === line.serviceId);
      if (!service) return { success: false, error: "One of the items in this sale no longer exists." };
      currency = service.currency;
      resolved.push({
        serviceId: service.id,
        quantity: line.quantity,
        unitPrice: Number(service.price),
        name: service.name,
      });
    }
  }

  if (resolved.length === 0) return { success: false, error: "Add at least one item to the sale." };

  // No delivery fee at the register, and commission still accrues the same
  // way it would online (this is what the platform bills the merchant for
  // later) — POS just never deducts it from the cash in hand.
  const commissionRate = store.subscription ? Number(store.subscription.commissionRate) : 8;
  const { subtotal, commission, total } = calculateOrderTotals(
    resolved.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    0,
    commissionRate
  );
  if (subtotal <= 0) return { success: false, error: "Sale total must be greater than zero." };

  const walkIn = await getOrCreateWalkInCustomer(store.id);

  // Persist a store-scoped customer profile for named POS buyers. This makes
  // offline/POS purchases first-class CRM data without creating fake login
  // accounts for customers who never registered. An explicitly selected
  // profile is preferred; otherwise the profile is matched by phone/email.
  let customerProfileId: string | null = null;
  const customerName = data.customerName?.trim() || null;
  const customerPhone = data.customerPhone?.trim() || null;
  const customerEmail = data.customerEmail?.trim().toLowerCase() || null;
  if (data.customerProfileId) {
    const profile = await prisma.storeCustomerProfile.findFirst({
      where: { id: data.customerProfileId, storeId: store.id },
      select: { id: true },
    });
    if (!profile) return { success: false, error: "The selected customer is no longer available." };
    customerProfileId = profile.id;
  } else if (customerName || customerPhone || customerEmail) {
    const [existing, matchingUser] = await Promise.all([
      prisma.storeCustomerProfile.findFirst({
        where: {
          storeId: store.id,
          OR: [
            ...(customerPhone ? [{ phone: customerPhone }] : []),
            ...(customerEmail ? [{ email: customerEmail }] : []),
          ],
        },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
      }),
      customerEmail ? prisma.user.findUnique({ where: { email: customerEmail }, select: { id: true } }) : Promise.resolve(null),
    ]);
    const profile = existing
      ? await prisma.storeCustomerProfile.update({
          where: { id: existing.id },
          data: { name: customerName ?? undefined, phone: customerPhone ?? undefined, email: customerEmail ?? undefined, userId: matchingUser?.id ?? undefined },
          select: { id: true },
        })
      : await prisma.storeCustomerProfile.create({
          data: { storeId: store.id, userId: matchingUser?.id ?? null, name: customerName || customerPhone || customerEmail || "Customer", phone: customerPhone, email: customerEmail },
          select: { id: true },
        });
    customerProfileId = profile.id;
  }

  // Order + payment + commission accrual + every stock decrement live in
  // one transaction: if any line turns out to be oversold (a concurrent
  // sale beat this one to the last unit) the whole sale rolls back rather
  // than leaving a paid order with wrong stock, or stock decremented with
  // no payment recorded. The stock updates are also written as
  // conditional updateMany calls (not "read quantity, then write") so two
  // simultaneous POS sales for the same item can't both succeed off a
  // stale read.
  let orderId: string;
  try {
    orderId = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.create({
          data: {
            storeId: store.id,
            buyerId: walkIn.id,
            status: "PAID",
            channel: "POS",
            subtotal,
            commission,
            total,
            currency,
            deliveryFee: 0,
            paymentProvider: "CASH",
            posTenderType: data.tenderType,
            posCustomerName: customerName,
            posCustomerPhone: customerPhone,
            customerProfileId,
            items: {
              create: resolved.map((l) => ({
                productId: l.productId ?? null,
                variantId: l.variantId ?? null,
                serviceId: l.serviceId ?? null,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
              })),
            },
          },
        });

        await tx.orderStatusEvent.create({
          data: { orderId: order.id, status: "PAID", note: `POS sale — ${data.tenderType}` },
        });

        await tx.payment.create({
          data: {
            orderId: order.id,
            storeId: store.id,
            purpose: "ORDER",
            provider: "CASH",
            reference: `POS-${order.id}`,
            status: "SUCCESSFUL",
            amount: total,
            currency,
            verifiedAt: new Date(),
          },
        });

        // No gateway split happened for this sale (it was cash/card-in-hand),
        // so the commission the platform is owed just accrues on the store
        // instead of being deducted automatically -- see
        // Store.posCommissionOwed and recordPosCommissionSettlement below for
        // how it's cleared.
        if (commission > 0) {
          await tx.store.update({
            where: { id: store.id },
            data: { posCommissionOwed: { increment: commission } },
          });
        }

        // Decrement stock for every line that tracks it. Kept as its own
        // logic here (not adjustStock/adjustVariantStock from
        // inventory.ts/variant.ts) so a cashier who only has the "pos"
        // permission -- not "products" -- can still complete a sale; those
        // two functions gate on "products" access. Each decrement is a
        // conditional updateMany (quantity gte the amount being sold) so a
        // concurrent sale for the same item can't oversell it -- whichever
        // transaction commits second sees 0 rows affected and rolls back.
        for (const line of resolved) {
          if (line.variantId) {
            const variant = variants.find((v) => v.id === line.variantId)!;
            const result = await tx.productVariant.updateMany({
              where: { id: line.variantId, quantity: { gte: line.quantity } },
              data: { quantity: { decrement: line.quantity } },
            });
            if (result.count === 0) {
              throw new PosTransactionError(`Not enough stock for ${variant.product.name} — ${variant.label}.`);
            }
            const fresh = await tx.productVariant.findUniqueOrThrow({ where: { id: line.variantId } });
            if (fresh.quantity === 0 && !fresh.autoUnpublished) {
              await tx.productVariant.update({ where: { id: line.variantId }, data: { autoUnpublished: true } });
            }
            await tx.stockMovement.create({
              data: {
                variantId: line.variantId,
                storeId: store.id,
                type: "SALE",
                quantityChange: -line.quantity,
                quantityAfter: fresh.quantity,
                note: `POS sale (order ${order.id})`,
              },
            });
          } else if (line.productId) {
            const product = products.find((p) => p.id === line.productId);
            if (!product?.inventory) continue; // stock not tracked for this product
            const result = await tx.inventoryItem.updateMany({
              where: { id: product.inventory.id, quantity: { gte: line.quantity } },
              data: { quantity: { decrement: line.quantity } },
            });
            if (result.count === 0) {
              throw new PosTransactionError(`Not enough stock for ${product.name}.`);
            }
            const fresh = await tx.inventoryItem.findUniqueOrThrow({ where: { id: product.inventory.id } });
            if (fresh.quantity === 0) {
              if (!fresh.autoUnpublished) {
                await tx.inventoryItem.update({ where: { id: product.inventory.id }, data: { autoUnpublished: true } });
              }
              await tx.product.update({ where: { id: product.id }, data: { isPublished: false } });
            }
            await tx.stockMovement.create({
              data: {
                inventoryItemId: product.inventory.id,
                storeId: store.id,
                type: "SALE",
                quantityChange: -line.quantity,
                quantityAfter: fresh.quantity,
                note: `POS sale (order ${order.id})`,
              },
            });
          }
        }

        return order.id;
      },
      { timeout: 15000 }
    );
  } catch (err) {
    if (err instanceof PosTransactionError) return { success: false, error: err.message };
    throw err;
  }

  // Side effects that aren't part of the store's own data consistency --
  // webhooks are an external call (shouldn't sit inside a DB transaction
  // holding a connection open) and the activity log is best-effort audit
  // trail, not something a failure here should roll the sale back for.
  await emitWebhookEvent("ORDER_CREATED", store.id, {
    orderId,
    storeId: store.id,
    status: "PAID",
    channel: "POS",
    subtotal,
    total,
    currency,
  });
  await emitWebhookEvent("PAYMENT_SUCCESS", store.id, {
    orderId,
    amount: total,
    currency,
    provider: "CASH",
  });

  const session = await auth();
  await logStoreActivity({
    storeId: store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "pos.sale_completed",
    target: `Order #${orderId.slice(-8).toUpperCase()}`,
    metadata: { orderId, total, itemCount: resolved.length, tenderType: data.tenderType },
  });

  revalidatePath(`/store/${slug}/admin/pos`);
  revalidatePath(`/store/${slug}/admin/customers`);
  revalidatePath(`/store/${slug}/admin/orders`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  revalidatePath(`/store/${slug}/admin/products`);

  return { success: true, data: { orderId, total: roundMoney(total) } };
}

// --- Register summary (today's sales, shown on the POS page) ------------

export type PosDailySummary = { salesCount: number; totalAmount: number; currency: string };

export async function getPosDailySummary(slug: string): Promise<PosDailySummary> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { salesCount: 0, totalAmount: 0, currency: "NGN" };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { storeId: access.store.id, channel: "POS", createdAt: { gte: startOfDay }, status: { not: "CANCELLED" } },
    select: { total: true, currency: true },
  });

  return {
    salesCount: orders.length,
    totalAmount: roundMoney(orders.reduce((sum, o) => sum + Number(o.total), 0)),
    currency: orders[0]?.currency ?? "NGN",
  };
}

// --- Commission owed (POS sales bypass the gateway split) ---------------

export type PosCommissionBalance = {
  owed: number;
  currency: string;
  recentSettlements: { id: string; amount: number; note: string | null; settledByEmail: string; createdAt: Date }[];
};

/**
 * "orders" permission — same area an owner already thinks of as
 * money/sales bookkeeping (see the Payments page this feeds), separate
 * from "pos" which only needs to cover ringing up sales at the register.
 */
async function assertCommissionAccess(slug: string): Promise<StoreAccessResult> {
  const result = await assertStorePermission(slug, "payments");
  if (!result.success) return result;
  return { success: true, store: result.store };
}

export async function getPosCommissionBalance(slug: string): Promise<PosCommissionBalance> {
  const access = await assertCommissionAccess(slug);
  if (!access.success) return { owed: 0, currency: "NGN", recentSettlements: [] };

  const [store, settlements] = await Promise.all([
    prisma.store.findUnique({ where: { id: access.store.id }, select: { posCommissionOwed: true } }),
    prisma.posCommissionSettlement.findMany({
      where: { storeId: access.store.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    owed: roundMoney(Number(store?.posCommissionOwed ?? 0)),
    currency: "NGN",
    recentSettlements: settlements.map((s) => ({
      id: s.id,
      amount: Number(s.amount),
      note: s.note,
      settledByEmail: s.settledByEmail,
      createdAt: s.createdAt,
    })),
  };
}

/**
 * Records that some (or all) of the accrued POS commission balance has
 * been paid to the platform outside the app (bank transfer, etc) and
 * clears it from Store.posCommissionOwed. This doesn't move any money
 * itself -- it's the same "record what already happened" shape as
 * issueRefund, not a payment action.
 */
export async function recordPosCommissionSettlement(
  slug: string,
  amount: number,
  note?: string
): Promise<ActionResult<{ remainingOwed: number }>> {
  const access = await assertCommissionAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const roundedAmount = roundMoney(amount);
  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    return { success: false, error: "Enter a settlement amount greater than zero." };
  }

  const session = await auth();
  const settledByEmail = session?.user?.email ?? "unknown";

  // Guarded updateMany instead of read-then-write: two settlement requests
  // submitted around the same time (two tabs, a double-click) could both
  // read the same "owed" balance, both pass the "amount <= owed" check
  // against that stale read, and between them decrement past zero. The
  // `gte` condition makes the check and the decrement one atomic
  // operation — whichever request commits second sees 0 rows affected and
  // is told the balance it was checking against no longer exists, rather
  // than silently succeeding on stale data. Same pattern as the POS stock
  // decrement in createPosSale above.
  let remainingOwed: number;
  try {
    remainingOwed = await prisma.$transaction(async (tx) => {
      const result = await tx.store.updateMany({
        where: { id: access.store.id, posCommissionOwed: { gte: roundedAmount } },
        data: { posCommissionOwed: { decrement: roundedAmount } },
      });
      if (result.count === 0) {
        const current = await tx.store.findUnique({ where: { id: access.store.id }, select: { posCommissionOwed: true } });
        throw new PosTransactionError(`That's more than the ${Number(current?.posCommissionOwed ?? 0).toLocaleString()} currently owed.`);
      }

      await tx.posCommissionSettlement.create({
        data: { storeId: access.store.id, amount: roundedAmount, note: note?.trim() || null, settledByEmail },
      });

      const updated = await tx.store.findUniqueOrThrow({ where: { id: access.store.id }, select: { posCommissionOwed: true } });
      return Number(updated.posCommissionOwed);
    });
  } catch (err) {
    if (err instanceof PosTransactionError) return { success: false, error: err.message };
    throw err;
  }

  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "pos.commission_settled",
    target: `${roundedAmount.toLocaleString()}`,
    metadata: { amount: roundedAmount, note: note?.trim() || undefined },
  });

  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: { remainingOwed } };
}
