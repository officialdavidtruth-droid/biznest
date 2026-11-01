import type { CrmLead, CrmLeadSource, CrmLeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/crm-lead-input";

const CLOSED: CrmLeadStatus[] = ["WON", "LOST"];

/** An open (not Won/Lost) lead in this store with the same email (case-insensitive) or the same phone. */
export async function findOpenLead(storeId: string, match: { email?: string | null; phone?: string | null }): Promise<CrmLead | null> {
  const email = normalizeEmail(match.email);
  const phone = match.phone?.trim() || null;
  const or = [...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []), ...(phone ? [{ phone }] : [])];
  if (!or.length) return null;
  return prisma.crmLead.findFirst({ where: { storeId, status: { notIn: CLOSED }, OR: or }, orderBy: { createdAt: "asc" } });
}

/**
 * Single entry point for leads created by public forms (contact, quote request).
 * Re-submitting while an earlier lead is still open reuses it instead of
 * creating a duplicate; email is normalised so "Ada@x.com" and "ada@x.com" match.
 */
export async function findOrCreateOpenLead(
  storeId: string,
  data: { name: string; email?: string | null; phone?: string | null; source: CrmLeadSource; notes?: string | null; value?: number }
): Promise<{ lead: CrmLead; created: boolean }> {
  const email = normalizeEmail(data.email);
  const phone = data.phone?.trim() || null;
  const existing = await findOpenLead(storeId, { email, phone });
  if (existing) return { lead: existing, created: false };
  const lead = await prisma.crmLead.create({ data: { storeId, name: data.name, email, phone, source: data.source, notes: data.notes ?? null, value: data.value } });
  return { lead, created: true };
}
