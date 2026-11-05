"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { revalidatePath } from "next/cache";
import { runAutomationsForEvent } from "@/lib/automations/engine";
import { findOpenLead } from "@/lib/crm-leads";
import {
  ACTIVITY_TYPES, CONTACT_ACTIVITY_TYPES, LEAD_LIMITS, cleanNotes, isLeadStatus, parseFollowUp, parseLeadValue,
  validateLeadContact, validateNewLead,
} from "@/lib/crm-lead-input";

const clean = (v: string | undefined | null) => v?.trim() || null;

/** Open leads loaded onto the board. Closed (Won/Lost) leads are capped separately. */
const OPEN_LEAD_LIMIT = 500;
const CLOSED_LEAD_LIMIT = 100;
const STAGE_LABEL: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", PROPOSAL: "Proposal", WON: "Won", LOST: "Lost" };

/**
 * Every CRM action goes through this: staff permission AND the CRM & Sales app
 * being installed and on the store's plan. The page checks this too, but server
 * actions are directly callable, so the check has to live here as well.
 */
async function assertCrmAccess(slug: string) {
  const access = await assertStorePermission(slug, "customers");
  if (!access.success) return access;
  const entitlement = await getPluginEntitlement(access.store.id, "crm");
  if (!entitlement.allowed || !entitlement.installed) {
    return { success: false as const, error: "CRM & Sales isn't active on this store. Install it from Apps." };
  }
  return access;
}

const revalidateCrm = (slug: string) => revalidatePath(`/store/${slug}/admin/apps/crm`);

export async function getCrmDashboard(slug: string) {
  const access = await assertCrmAccess(slug);
  if (!access.success) return { success: false as const, error: access.error };
  const storeId = access.store.id;
  const leadSelect = {
    id: true, name: true, email: true, phone: true, company: true, source: true, status: true, value: true, currency: true, notes: true,
    lastContactedAt: true, nextFollowUpAt: true, createdAt: true, updatedAt: true,
    activities: { orderBy: { createdAt: "desc" as const }, take: 5, select: { id: true, type: true, title: true, body: true, createdAt: true } },
  };
  const [openLeads, closedLeads, customers, won, pipeline] = await Promise.all([
    prisma.crmLead.findMany({ where: { storeId, status: { notIn: ["WON", "LOST"] } }, orderBy: { updatedAt: "desc" }, take: OPEN_LEAD_LIMIT, select: leadSelect }),
    prisma.crmLead.findMany({ where: { storeId, status: { in: ["WON", "LOST"] } }, orderBy: { updatedAt: "desc" }, take: CLOSED_LEAD_LIMIT, select: leadSelect }),
    prisma.storeCustomerProfile.count({ where: { storeId } }),
    prisma.crmLead.aggregate({ where: { storeId, status: "WON" }, _sum: { value: true }, _count: { _all: true } }),
    prisma.crmLead.groupBy({ where: { storeId }, by: ["status"], _count: { _all: true }, _sum: { value: true } }),
  ]);
  // Totals come from the database, not from the (capped) rows on the board.
  const open = pipeline.filter((p) => p.status !== "WON" && p.status !== "LOST");
  const openCount = open.reduce((n, p) => n + p._count._all, 0);
  const openValue = open.reduce((n, p) => n + Number(p._sum.value ?? 0), 0);
  const leads = [...openLeads, ...closedLeads].map((lead) => ({ ...lead, value: lead.value === null ? null : Number(lead.value) }));
  return {
    success: true as const,
    data: { leads, customerCount: customers, wonCount: won._count._all, wonValue: Number(won._sum.value ?? 0), openCount, openValue, truncated: openCount > OPEN_LEAD_LIMIT },
  };
}

export async function createCrmLead(slug: string, input: { name: string; email?: string; phone?: string; company?: string; source?: string; value?: number; notes?: string; nextFollowUpAt?: string }) {
  const access = await assertCrmAccess(slug);
  if (!access.success) return access;
  const checked = validateNewLead(input);
  if (!checked.ok) return { success: false as const, error: checked.error };
  const d = checked.data;
  try {
    const dupe = await findOpenLead(access.store.id, { email: d.email, phone: d.phone });
    if (dupe) return { success: false as const, error: `${dupe.name} is already an open lead with the same ${d.email && dupe.email?.toLowerCase() === d.email ? "email" : "phone number"}. Open that lead instead.` };
    const lead = await prisma.crmLead.create({
      data: { storeId: access.store.id, name: d.name, email: d.email, phone: d.phone, company: d.company, source: d.source, value: d.value ?? undefined, notes: d.notes, nextFollowUpAt: d.nextFollowUpAt ?? undefined },
    });
    try {
      await runAutomationsForEvent({ type: "CRM_LEAD_CREATED", storeId: access.store.id, data: { leadId: lead.id, name: lead.name, email: lead.email ?? undefined } });
    } catch { /* The lead is saved; a failed automation must not make the merchant think it wasn't. */ }
    revalidateCrm(slug);
    return { success: true as const, data: { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, source: lead.source, value: d.value, notes: lead.notes, nextFollowUpAt: d.nextFollowUpAt ? d.nextFollowUpAt.toISOString() : null } };
  } catch {
    return { success: false as const, error: "Could not create the lead. Please try again." };
  }
}

export async function updateCrmLeadStatus(slug: string, id: string, status: string) {
  const access = await assertCrmAccess(slug);
  if (!access.success) return access;
  if (!isLeadStatus(status)) return { success: false as const, error: "Invalid lead status." };
  const lead = await prisma.crmLead.findFirst({ where: { id, storeId: access.store.id }, select: { id: true, status: true } });
  if (!lead) return { success: false as const, error: "Lead not found." };
  if (lead.status === status) return { success: true as const, data: { activity: null } };
  try {
    const [, activity] = await prisma.$transaction([
      prisma.crmLead.update({ where: { id }, data: { status, ...(status === "CONTACTED" ? { lastContactedAt: new Date() } : {}) } }),
      prisma.crmActivity.create({ data: { leadId: id, type: "STAGE", title: `Moved to ${STAGE_LABEL[status]}`, body: `From ${STAGE_LABEL[lead.status] ?? lead.status}.` }, select: { id: true, type: true, title: true, body: true, createdAt: true } }),
    ]);
    revalidateCrm(slug);
    return { success: true as const, data: { activity } };
  } catch {
    return { success: false as const, error: "Could not update the lead." };
  }
}

export async function updateCrmLeadDetails(slug: string, id: string, input: { value?: number | null; nextFollowUpAt?: string | null; notes?: string | null }) {
  const access = await assertCrmAccess(slug);
  if (!access.success) return access;
  const data: { value?: number | null; nextFollowUpAt?: Date | null; notes?: string | null } = {};
  if ("value" in input) {
    const v = parseLeadValue(input.value);
    if (!v.ok) return { success: false as const, error: v.error };
    data.value = v.value;
  }
  if ("nextFollowUpAt" in input) {
    const f = parseFollowUp(input.nextFollowUpAt);
    if (!f.ok) return { success: false as const, error: f.error };
    data.nextFollowUpAt = f.date;
  }
  if ("notes" in input) data.notes = cleanNotes(input.notes);
  if (!Object.keys(data).length) return { success: true as const };
  const result = await prisma.crmLead.updateMany({ where: { id, storeId: access.store.id }, data });
  if (!result.count) return { success: false as const, error: "Lead not found." };
  revalidateCrm(slug);
  return { success: true as const };
}

/** Edit who the lead is (name, email, phone, company, source). Previously locked after creation. */
export async function updateCrmLeadContact(slug: string, id: string, input: { name: string; email?: string | null; phone?: string | null; company?: string | null; source?: string }) {
  const access = await assertCrmAccess(slug);
  if (!access.success) return access;
  const checked = validateLeadContact(input);
  if (!checked.ok) return { success: false as const, error: checked.error };
  const result = await prisma.crmLead.updateMany({ where: { id, storeId: access.store.id }, data: checked.data });
  if (!result.count) return { success: false as const, error: "Lead not found." };
  revalidateCrm(slug);
  return { success: true as const, data: checked.data };
}

/** Permanently removes a lead and its activity log (activities cascade). */
export async function deleteCrmLead(slug: string, id: string) {
  const access = await assertCrmAccess(slug);
  if (!access.success) return access;
  const result = await prisma.crmLead.deleteMany({ where: { id, storeId: access.store.id } });
  if (!result.count) return { success: false as const, error: "Lead not found." };
  revalidateCrm(slug);
  return { success: true as const };
}

export async function addCrmActivity(slug: string, id: string, input: { type: string; title: string; body?: string }) {
  const access = await assertCrmAccess(slug);
  if (!access.success) return access;
  const type = String(input.type ?? "").trim().toUpperCase();
  if (!(ACTIVITY_TYPES as readonly string[]).includes(type)) return { success: false as const, error: "Choose an activity type." };
  const title = String(input.title ?? "").trim().slice(0, LEAD_LIMITS.activityTitle);
  if (!title) return { success: false as const, error: "Add a short title for the activity." };
  const lead = await prisma.crmLead.findFirst({ where: { id, storeId: access.store.id }, select: { id: true } });
  if (!lead) return { success: false as const, error: "Lead not found." };
  try {
    const writes = [
      prisma.crmActivity.create({ data: { leadId: id, type, title, body: cleanNotes(input.body, LEAD_LIMITS.activityBody) } }),
      // Only a real touchpoint counts as "contacted"; a private note does not.
      ...((CONTACT_ACTIVITY_TYPES as readonly string[]).includes(type) ? [prisma.crmLead.update({ where: { id }, data: { lastContactedAt: new Date() } })] : []),
    ] as const;
    const [activity] = await prisma.$transaction([...writes]);
    revalidateCrm(slug);
    return { success: true as const, data: activity };
  } catch {
    return { success: false as const, error: "Could not log the activity." };
  }
}

export async function saveStoreSeo(slug:string,input:{title:string;description:string;keywords?:string;canonicalUrl?:string;ogImage?:string;noIndex:boolean;googleVerification?:string}){
  const access=await assertStorePermission(slug,"settings"); if(!access.success) return access;
  const seoEntitlement=await getPluginEntitlement(access.store.id,"seo");
  if(!seoEntitlement.allowed||!seoEntitlement.installed) return {success:false,error:"Install the SEO app to manage search settings."};
  const title=input.title.trim().slice(0,180), description=input.description.trim().slice(0,320);
  if(!title || !description) return {success:false,error:"SEO title and description are required."};
  const url=(input.canonicalUrl||"").trim();
  if(url && !/^https:\/\//i.test(url)) return {success:false,error:"Canonical URL must use HTTPS."};
  await prisma.store.update({where:{id:access.store.id},data:{seoTitle:title,seoDescription:description,seoKeywords:clean(input.keywords)?.slice(0,500),seoCanonicalUrl:clean(url),seoOgImage:clean(input.ogImage),seoNoIndex:input.noIndex,seoGoogleVerification:clean(input.googleVerification)}});
  revalidatePath(`/store/${slug}/admin/apps/seo`);
  revalidatePath(`/store/${slug}`);
  return {success:true};
}