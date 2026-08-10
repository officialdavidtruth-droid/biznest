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

export type SupplierInput = {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: { line1?: string; city?: string; state?: string; country?: string };
  notes?: string;
};

// --- Reads -------------------------------------------------------------

export async function listSuppliers(slug: string, includeArchived = false) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.supplier.findMany({
    where: { storeId: access.store.id, ...(includeArchived ? {} : { isArchived: false }) },
    include: { _count: { select: { purchaseOrders: true, products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getSupplier(slug: string, supplierId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;

  return prisma.supplier.findFirst({
    where: { id: supplierId, storeId: access.store.id },
    include: {
      products: { include: { product: true } },
      purchaseOrders: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

// --- Writes --------------------------------------------------------------

export async function createSupplier(slug: string, input: SupplierInput): Promise<ActionResult<{ supplierId: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (!input.name?.trim()) return { success: false, error: "Supplier name is required." };

  const supplier = await prisma.supplier.create({
    data: {
      storeId: access.store.id,
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address ?? undefined,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath(`/store/${slug}/admin/suppliers`);
  return { success: true, data: { supplierId: supplier.id } };
}

export async function updateSupplier(slug: string, supplierId: string, input: SupplierInput): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (!input.name?.trim()) return { success: false, error: "Supplier name is required." };

  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, storeId: access.store.id } });
  if (!existing) return { success: false, error: "Supplier not found." };

  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address ?? undefined,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath(`/store/${slug}/admin/suppliers`);
  return { success: true, data: undefined };
}

/**
 * Archives rather than deletes -- a supplier with purchase order history
 * needs to stay resolvable from those POs, so this just hides it from the
 * active picker instead of removing the row.
 */
export async function archiveSupplier(slug: string, supplierId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, storeId: access.store.id } });
  if (!existing) return { success: false, error: "Supplier not found." };

  await prisma.supplier.update({ where: { id: supplierId }, data: { isArchived: true } });

  revalidatePath(`/store/${slug}/admin/suppliers`);
  return { success: true, data: undefined };
}

export async function linkSupplierProduct(
  slug: string,
  supplierId: string,
  productId: string,
  input: { supplierSku?: string; costPrice?: number }
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const [supplier, product] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: supplierId, storeId: access.store.id } }),
    prisma.product.findFirst({ where: { id: productId, storeId: access.store.id } }),
  ]);
  if (!supplier) return { success: false, error: "Supplier not found." };
  if (!product) return { success: false, error: "Product not found." };

  await prisma.supplierProduct.upsert({
    where: { supplierId_productId: { supplierId, productId } },
    create: {
      supplierId,
      productId,
      supplierSku: input.supplierSku?.trim() || null,
      costPrice: input.costPrice != null ? roundMoney(input.costPrice) : null,
    },
    update: {
      supplierSku: input.supplierSku?.trim() || null,
      costPrice: input.costPrice != null ? roundMoney(input.costPrice) : null,
    },
  });

  revalidatePath(`/store/${slug}/admin/suppliers/${supplierId}`);
  return { success: true, data: undefined };
}

export async function unlinkSupplierProduct(slug: string, supplierId: string, productId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const link = await prisma.supplierProduct.findFirst({
    where: { supplierId, productId, supplier: { storeId: access.store.id } },
  });
  if (!link) return { success: false, error: "Link not found." };

  await prisma.supplierProduct.delete({ where: { id: link.id } });

  revalidatePath(`/store/${slug}/admin/suppliers/${supplierId}`);
  return { success: true, data: undefined };
}
