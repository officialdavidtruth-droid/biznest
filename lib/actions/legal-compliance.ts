"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import type { ActionResult } from "@/types/actions";

const KEY = "legal-compliance";

async function guard(slug: string) {
  const a = await assertStorePermission(slug, `plugin:${KEY}`);
  if (!a.success) return { ok: false as const, error: a.error };
  const e = await getPluginEntitlement(a.store.id, KEY);
  if (!e.allowed || !e.installed) return { ok: false as const, error: e.reason ?? "Install this app first." };
  return { ok: true as const, store: a.store };
}

function parseExpiry(value?: string | null): { ok: true; date: Date | null } | { ok: false; error: string } {
  if (!value) return { ok: true, date: null };
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "That expiry date isn't valid." };
  return { ok: true, date: d };
}

export type LegalDocument = {
  id: string;
  title: string;
  documentType: string;
  fileUrl: string;
  expiresAt: string | null;
  createdAt: string;
  notes: string | null;
};

export type LegalApproval = { id: string; title: string; requestType: string; createdAt: string };

export async function getLegalWorkspace(slug: string) {
  const g = await guard(slug);
  if (!g.ok) return { error: g.error };
  const storeId = g.store.id;
  const [docs, approvals] = await Promise.all([
    prisma.businessDocument.findMany({ where: { storeId }, orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 300 }),
    prisma.approvalRequest.findMany({ where: { storeId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 20, select: { id: true, title: true, requestType: true, createdAt: true } }),
  ]);
  const documents: LegalDocument[] = docs.map((d) => {
    const meta = d.metadata && typeof d.metadata === "object" && !Array.isArray(d.metadata) ? (d.metadata as Record<string, unknown>) : {};
    return { id: d.id, title: d.title, documentType: d.documentType, fileUrl: d.fileUrl, expiresAt: d.expiresAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString(), notes: typeof meta.notes === "string" ? meta.notes : null };
  });
  return {
    storeName: g.store.name,
    documents,
    approvals: approvals.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })) as LegalApproval[],
  };
}

export async function addLegalDocument(slug: string, input: { title: string; documentType: string; fileUrl: string; expiresAt?: string; notes?: string }): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const title = input.title.trim();
  const documentType = input.documentType.trim();
  if (!title) return { success: false, error: "Give the document a title." };
  if (!documentType) return { success: false, error: "Choose a document type." };
  let url: URL;
  try { url = new URL(input.fileUrl.trim()); } catch { return { success: false, error: "Upload a file or paste a valid https link." }; }
  if (url.protocol !== "https:") return { success: false, error: "Only secure https links are allowed." };
  const exp = parseExpiry(input.expiresAt);
  if (!exp.ok) return { success: false, error: exp.error };
  const session = await auth();
  await prisma.businessDocument.create({
    data: { storeId: g.store.id, title, documentType, fileUrl: url.toString(), expiresAt: exp.date, metadata: input.notes?.trim() ? { notes: input.notes.trim() } : undefined, createdById: session?.user?.id ?? null },
  });
  revalidatePath(`/store/${slug}/admin/apps/${KEY}`);
  return { success: true, data: undefined };
}

export async function setLegalDocumentExpiry(slug: string, id: string, expiresAt: string | null): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const exp = parseExpiry(expiresAt);
  if (!exp.ok) return { success: false, error: exp.error };
  const r = await prisma.businessDocument.updateMany({ where: { id, storeId: g.store.id }, data: { expiresAt: exp.date } });
  if (!r.count) return { success: false, error: "Document not found." };
  revalidatePath(`/store/${slug}/admin/apps/${KEY}`);
  return { success: true, data: undefined };
}

export async function deleteLegalDocument(slug: string, id: string): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const r = await prisma.businessDocument.deleteMany({ where: { id, storeId: g.store.id } });
  if (!r.count) return { success: false, error: "Document not found." };
  revalidatePath(`/store/${slug}/admin/apps/${KEY}`);
  return { success: true, data: undefined };
}
