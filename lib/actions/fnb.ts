"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
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
  const session = await auth();
  const shiftHistoryWhere = a.role === "STAFF" && session?.user?.id ? { storeId, staffUserId: session.user.id } : { storeId };

  const [orders, reservations, products, customers, currentShift, recentShifts] = await Promise.all([
    prisma.order.findMany({ where: { storeId, createdAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, total: true, currency: true, status: true, channel: true, posCustomerName: true, createdAt: true, items: { select: { quantity: true, product: { select: { name: true } }, variant: { select: { label: true, product: { select: { name: true } } } } } } } }),
    prisma.booking.count({ where: { storeId, scheduledAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED"] } } }),
    prisma.product.findMany({ where: { storeId, type: "PHYSICAL" }, select: { id: true, name: true, price: true, currency: true, images: true, attributes: true, isPublished: true }, orderBy: { name: "asc" }, take: 200 }),
    prisma.storeCustomerProfile.findMany({ where: { storeId }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, name: true, email: true, phone: true, updatedAt: true } }),
    session?.user?.id ? prisma.fnbShift.findFirst({ where: { storeId, staffUserId: session.user.id, status: "OPEN" }, orderBy: { startedAt: "desc" }, select: { id: true, status: true, startedAt: true, endedAt: true, salesCount: true, salesTotal: true } }) : Promise.resolve(null),
    prisma.fnbShift.findMany({ where: shiftHistoryWhere, orderBy: { startedAt: "desc" }, take: 20, select: { id: true, status: true, startedAt: true, endedAt: true, salesCount: true, salesTotal: true, staffUser: { select: { id: true, name: true, email: true } } } }),
  ]);

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const activeOrders = orders.filter((o) => ["PAID", "IN_PROGRESS", "DELIVERED"].includes(o.status)).length;
  const recipeCount = products.filter((p) => extractFnbRecipe(p.attributes)).length;
  const plainOrders = orders.map((o) => ({ ...o, total: Number(o.total) }));
  const plainProducts = products.map((p) => ({ ...p, price: Number(p.price) }));
  const plainCurrentShift = currentShift ? { ...currentShift, salesTotal: Number(currentShift.salesTotal) } : null;
  const plainRecentShifts = recentShifts.map((shift) => ({ ...shift, salesTotal: Number(shift.salesTotal) }));

  return {
    storeName: a.store.name, role: a.role, orders: plainOrders, reservations, products: plainProducts, customers, currentShift: plainCurrentShift, recentShifts: plainRecentShifts,
    metrics: { revenue, activeOrders, recipeCount },
  };
}

export async function startFnbShift(slug: string): Promise<ActionResult<{ id: string; startedAt: Date }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "You must be signed in." };

  const existing = await prisma.fnbShift.findFirst({
    where: { storeId: a.store.id, staffUserId: userId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) return { success: false, error: "You already have an open shift. End it before starting another." };

  try {
    const shift = await prisma.fnbShift.create({ data: { storeId: a.store.id, staffUserId: userId } });
    revalidatePath(`/store/${slug}/admin/fnb`);
    return { success: true, data: { id: shift.id, startedAt: shift.startedAt } };
  } catch (err: any) {
    if (err?.code === "P2002") return { success: false, error: "You already have an open shift. End it before starting another." };
    throw err;
  }
}

export async function endFnbShift(slug: string): Promise<ActionResult<{ id: string; endedAt: Date; salesCount: number; salesTotal: number }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "You must be signed in." };

  const shift = await prisma.fnbShift.findFirst({
    where: { storeId: a.store.id, staffUserId: userId, status: "OPEN" },
    select: { id: true },
  });
  if (!shift) return { success: false, error: "You do not have an open shift." };

  const endedAt = new Date();
  const sales = await prisma.order.aggregate({
    where: { storeId: a.store.id, fnbShiftId: shift.id, channel: "POS", status: { notIn: ["CANCELLED", "REFUNDED"] } },
    _count: { _all: true },
    _sum: { total: true },
  });
  const result = await prisma.fnbShift.updateMany({
    where: { id: shift.id, storeId: a.store.id, staffUserId: userId, status: "OPEN" },
    data: { status: "CLOSED", endedAt, salesCount: sales._count._all, salesTotal: sales._sum.total ?? 0 },
  });
  if (result.count === 0) return { success: false, error: "This shift was already closed." };
  revalidatePath(`/store/${slug}/admin/fnb`);
  return { success: true, data: { id: shift.id, endedAt, salesCount: sales._count._all, salesTotal: Number(sales._sum.total ?? 0) } };
}

