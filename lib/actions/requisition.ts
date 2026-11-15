"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import type { ActionResult } from "@/types/actions";
import { createPurchaseOrder } from "@/lib/actions/purchase-order";

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CONVERTED", "CANCELLED"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type RequisitionStatus = (typeof STATUSES)[number];
export type RequisitionPriority = (typeof PRIORITIES)[number];

export type RequisitionLineInput = {
  productId?: string;
  variantId?: string;
  description: string;
  quantity: number;
  unit?: string;
  estimatedUnitCost?: number;
  note?: string;
};

async function accessStore(slug: string) {
  const access = await assertStorePermission(slug, "plugin:requisition");
  if (!access.success) return access;
  const entitlement = await getPluginEntitlement(access.store.id, "requisition");
  if (!entitlement.allowed) return { success: false as const, error: entitlement.reason };
  if (!entitlement.installed) return { success: false as const, error: "Install Requisitions from Apps to use this workspace." };
  return access;
}

function validPriority(value?: string): RequisitionPriority {
  return PRIORITIES.includes(value as RequisitionPriority) ? (value as RequisitionPriority) : "NORMAL";
}

export async function listRequisitions(slug: string) {
  const access = await accessStore(slug);
  if (!access.success) return [];

  return prisma.requisition.findMany({
    where: { storeId: access.store.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getRequisitionSummary(slug: string) {
  const access = await accessStore(slug);
  if (!access.success) return { total: 0, pending: 0, approved: 0, urgent: 0 };

  const rows = await prisma.requisition.findMany({
    where: { storeId: access.store.id, status: { not: "CANCELLED" } },
    select: { status: true, priority: true },
  });
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === "SUBMITTED").length,
    approved: rows.filter((r) => r.status === "APPROVED").length,
    urgent: rows.filter((r) => r.priority === "URGENT" && r.status !== "CONVERTED").length,
  };
}

export async function createRequisition(
  slug: string,
  input: { title: string; department?: string; priority?: string; neededBy?: string; notes?: string; requesterName?: string; items: RequisitionLineInput[] }
): Promise<ActionResult<{ id: string; number: string }>> {
  const access = await accessStore(slug);
  if (!access.success) return { success: false, error: access.error };

  const title = input.title.trim();
  if (!title) return { success: false, error: "Give the requisition a title." };
  if (!input.items.length) return { success: false, error: "Add at least one requested item." };

  for (const item of input.items) {
    if (!item.description.trim()) return { success: false, error: "Every line needs a description." };
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) return { success: false, error: "Requested quantities must be whole numbers greater than zero." };
    if (item.estimatedUnitCost != null && item.estimatedUnitCost < 0) return { success: false, error: "Estimated cost cannot be negative." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const store = await tx.store.update({ where: { id: access.store.id }, data: { nextRequisitionNo: { increment: 1 } }, select: { slug: true, nextRequisitionNo: true } });
    const number = `${store.slug.slice(0, 12).toUpperCase()}-REQ-${String(store.nextRequisitionNo - 1).padStart(5, "0")}`;
    const req = await tx.requisition.create({
      data: {
        number,
        storeId: access.store.id,
        title,
        department: input.department?.trim() || null,
        priority: validPriority(input.priority),
        neededBy: input.neededBy ? new Date(input.neededBy) : null,
        notes: input.notes?.trim() || null,
        requesterName: input.requesterName?.trim() || null,
        items: { create: input.items.map((i) => ({ productId: i.productId || null, variantId: i.variantId || null, description: i.description.trim(), quantity: i.quantity, unit: i.unit?.trim() || null, estimatedUnitCost: i.estimatedUnitCost ?? null, note: i.note?.trim() || null })) },
      },
      select: { id: true, number: true },
    });
    await tx.auditLog.create({ data: { action: "REQUISITION_CREATED", entity: "Requisition", entityId: req.id, metadata: { storeId: access.store.id, number } } });
    return req;
  });

  revalidatePath(`/store/${slug}/admin/apps/requisition`);
  return { success: true, data: result };
}

export async function submitRequisition(slug: string, requisitionId: string): Promise<ActionResult> {
  const access = await accessStore(slug);
  if (!access.success) return { success: false, error: access.error };
  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, storeId: access.store.id } });
  if (!req) return { success: false, error: "Requisition not found." };
  if (req.status !== "DRAFT") return { success: false, error: "Only draft requisitions can be submitted." };
  const financial = await prisma.storePlugin.findFirst({ where: { storeId: access.store.id, status: "ACTIVE", plugin: { key: "financial-control", status: "ACTIVE" } }, select: { id: true } });
  if (!financial) return { success: false, error: "Financial Control must be installed before a requisition can be submitted for approval." };
  const session = await auth();
  await prisma.$transaction(async (tx) => {
    await tx.requisition.update({ where: { id: req.id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    await tx.approvalRequest.create({ data: { storeId: access.store.id, title: `Requisition ${req.number}: ${req.title}`, requestType: "REQUISITION", entityType: "Requisition", entityId: req.id, requestedById: session?.user?.id ?? null, status: "PENDING", metadata: { approvalPluginKey: "financial-control" } } });
  });
  revalidatePath(`/store/${slug}/admin/apps/requisition`);
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: undefined };
}

export async function decideRequisition(slug: string, requisitionId: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<ActionResult> {
  return { success: false, error: "Requisitions are approved or rejected by the Financial Control app." };
}

export async function cancelRequisition(slug: string, requisitionId: string): Promise<ActionResult> {
  const access = await accessStore(slug);
  if (!access.success) return { success: false, error: access.error };
  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, storeId: access.store.id } });
  if (!req) return { success: false, error: "Requisition not found." };
  if (req.status === "CONVERTED") return { success: false, error: "A converted requisition cannot be cancelled." };
  await prisma.requisition.update({ where: { id: req.id }, data: { status: "CANCELLED" } });
  revalidatePath(`/store/${slug}/admin/apps/requisition`);
  return { success: true, data: undefined };
}


/**
 * Turns an approved requisition into a draft purchase order. Every line must be linked to a
 * product (or variant) because purchase orders receive into inventory. The requisition is
 * claimed first so two people cannot convert it twice; the claim is released if the PO fails.
 */
export async function convertRequisitionToPurchaseOrder(slug: string, requisitionId: string, supplierId: string): Promise<ActionResult<{ purchaseOrderId: string; poNumber: string }>> {
  const access = await accessStore(slug);
  if (!access.success) return { success: false, error: access.error };
  if (!supplierId) return { success: false, error: "Choose a supplier." };
  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, storeId: access.store.id }, include: { items: true } });
  if (!req) return { success: false, error: "Requisition not found." };
  if (req.status !== "APPROVED") return { success: false, error: "Only approved requisitions can be turned into a purchase order." };
  const unlinked = req.items.filter((i) => !i.productId && !i.variantId);
  if (unlinked.length) return { success: false, error: `Link these lines to a product first: ${unlinked.map((i) => i.description).join(", ")}.` };

  const claimed = await prisma.requisition.updateMany({ where: { id: req.id, status: "APPROVED" }, data: { status: "CONVERTED", convertedAt: new Date() } });
  if (claimed.count === 0) return { success: false, error: "This requisition was already converted." };

  const po = await createPurchaseOrder(slug, {
    supplierId,
    notes: `From requisition ${req.number}: ${req.title}`,
    expectedAt: req.neededBy ? req.neededBy.toISOString() : undefined,
    items: req.items.map((i) => ({ productId: i.productId ?? undefined, variantId: i.variantId ?? undefined, description: i.description, quantityOrdered: i.quantity, unitCost: Number(i.estimatedUnitCost ?? 0) })),
  });
  if (!po.success) {
    await prisma.requisition.updateMany({ where: { id: req.id, status: "CONVERTED" }, data: { status: "APPROVED", convertedAt: null } });
    return { success: false, error: po.error };
  }
  await prisma.auditLog.create({ data: { action: "REQUISITION_CONVERTED", entity: "Requisition", entityId: req.id, metadata: { storeId: access.store.id, purchaseOrderId: po.data.purchaseOrderId } } }).catch(() => {});
  revalidatePath(`/store/${slug}/admin/apps/requisition`);
  return po;
}
