"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/actions/activity";

const json = (v: unknown) => v as any;

export async function createAutomation(slug: string, input: { name: string; description?: string; trigger: string; conditions?: unknown; actions: unknown }) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  const a = await prisma.automation.create({ data: { storeId: access.store.id, name: input.name.trim(), description: input.description?.trim() || null, trigger: input.trigger.trim(), conditions: input.conditions ? json(input.conditions) : undefined, actions: json(input.actions), createdById: access.store.business.userId } });
  await logStoreActivity({ storeId: access.store.id, actor: { id: access.store.business.userId, role: access.role ?? "OWNER" }, action: "automation.created", target: a.id, metadata: { name: a.name, trigger: a.trigger } });
  return { success: true, data: a };
}

export async function toggleAutomation(slug: string, id: string, active: boolean) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  const a = await prisma.automation.updateMany({ where: { id, storeId: access.store.id }, data: { status: active ? "ACTIVE" : "PAUSED" } });
  return a.count ? { success: true } : { success: false, error: "Automation not found." };
}

export async function createApprovalRequest(slug: string, input: { title: string; requestType: string; entityType?: string; entityId?: string; note?: string; metadata?: unknown }) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  const r = await prisma.approvalRequest.create({ data: { storeId: access.store.id, title: input.title.trim(), requestType: input.requestType.trim(), entityType: input.entityType, entityId: input.entityId, requestedById: access.store.business.userId, note: input.note?.trim() || null, metadata: input.metadata ? json(input.metadata) : undefined } });
  return { success: true, data: r };
}

export async function decideApproval(slug: string, id: string, decision: "APPROVED" | "REJECTED", note?: string) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  const r = await prisma.approvalRequest.updateMany({ where: { id, storeId: access.store.id, status: "PENDING" }, data: { status: decision, note: note?.trim() || null, approverId: access.store.business.userId, decidedAt: new Date() } });
  return r.count ? { success: true } : { success: false, error: "Approval request not found or already decided." };
}

export async function createDocument(slug: string, input: { title: string; documentType: string; fileUrl: string; entityType?: string; entityId?: string; expiresAt?: Date; metadata?: unknown }) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  const d = await prisma.businessDocument.create({ data: { storeId: access.store.id, title: input.title.trim(), documentType: input.documentType.trim(), fileUrl: input.fileUrl, entityType: input.entityType, entityId: input.entityId, expiresAt: input.expiresAt, metadata: input.metadata ? json(input.metadata) : undefined, createdById: access.store.business.userId } });
  return { success: true, data: d };
}

export async function saveReportDefinition(slug: string, input: { name: string; description?: string; source: string; fields: unknown; filters?: unknown; groupBy?: unknown; schedule?: string; recipients?: unknown }) {
  const access = await assertStorePermission(slug, "analytics");
  if (!access.success) return access;
  const r = await prisma.reportDefinition.upsert({ where: { storeId_name: { storeId: access.store.id, name: input.name.trim() } }, create: { storeId: access.store.id, name: input.name.trim(), description: input.description?.trim() || null, source: input.source, fields: json(input.fields), filters: input.filters ? json(input.filters) : undefined, groupBy: input.groupBy ? json(input.groupBy) : undefined, schedule: input.schedule || null, recipients: input.recipients ? json(input.recipients) : undefined, createdById: access.store.business.userId }, update: { description: input.description?.trim() || null, source: input.source, fields: json(input.fields), filters: input.filters ? json(input.filters) : undefined, groupBy: input.groupBy ? json(input.groupBy) : undefined, schedule: input.schedule || null, recipients: input.recipients ? json(input.recipients) : undefined } });
  return { success: true, data: r };
}
