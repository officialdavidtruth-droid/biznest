"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";
import { nanoid } from "nanoid";

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
  return assertStorePermission(slug, "products");
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
  await prisma.requisition.update({ where: { id: req.id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  revalidatePath(`/store/${slug}/admin/apps/requisition`);
  return { success: true, data: undefined };
}

export async function decideRequisition(slug: string, requisitionId: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<ActionResult> {
  const access = await accessStore(slug);
  if (!access.success) return { success: false, error: access.error };
  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, storeId: access.store.id } });
  if (!req) return { success: false, error: "Requisition not found." };
  if (req.status !== "SUBMITTED") return { success: false, error: "Only submitted requisitions can be approved or rejected." };
  await prisma.$transaction(async (tx) => {
    await tx.requisition.update({ where: { id: req.id }, data: { status: decision, decisionNote: note?.trim() || null, decidedAt: new Date() } });
    await tx.approvalRequest.create({ data: { storeId: access.store.id, title: req.title, requestType: "REQUISITION", entityType: "Requisition", entityId: req.id, status: decision === "APPROVED" ? "APPROVED" : "REJECTED", note: note?.trim() || null, decidedAt: new Date() } });
  });
  revalidatePath(`/store/${slug}/admin/apps/requisition`);
  return { success: true, data: undefined };
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
