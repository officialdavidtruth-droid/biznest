"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { runAutomationsForEvent } from "@/lib/automations/engine";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MarketingContactInput = { email: string; name?: string; phone?: string; company?: string };

export async function importMarketingContacts(
  slug: string,
  contacts: MarketingContactInput[],
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in." };
  const access = await assertStorePermission(slug, "customers");
  if (!access.success) return { success: false, error: access.error };
  if (!access.store.marketingOnly) return { success: false, error: "This importer is for standalone Marketing accounts." };

  const unique = new Map<string, MarketingContactInput>();
  for (const item of contacts.slice(0, 5000)) {
    const email = item.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    if (!unique.has(email)) unique.set(email, { ...item, email });
  }

  let imported = 0;
  for (const contact of unique.values()) {
    const name = (contact.name?.trim() || contact.email).slice(0, 120);
    const existingProfile = await prisma.storeCustomerProfile.findFirst({
      where: { storeId: access.store.id, email: contact.email },
      select: { id: true },
    });
    const profile = existingProfile
      ? await prisma.storeCustomerProfile.update({ where: { id: existingProfile.id }, data: { name, phone: contact.phone?.trim() || undefined } })
      : await prisma.storeCustomerProfile.create({ data: { storeId: access.store.id, name, email: contact.email, phone: contact.phone?.trim() || null } });
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { storeId_email: { storeId: access.store.id, email: contact.email } },
      select: { id: true },
    });
    if (!subscriber) {
      await prisma.newsletterSubscriber.create({ data: { storeId: access.store.id, email: contact.email } });
    }
    const existingLead = await prisma.crmLead.findFirst({ where: { storeId: access.store.id, email: contact.email }, select: { id: true } });
    if (!existingLead) {
      const lead = await prisma.crmLead.create({
        data: {
          storeId: access.store.id,
          customerId: profile.id,
          name,
          email: contact.email,
          phone: contact.phone?.trim() || null,
          company: contact.company?.trim() || null,
          source: "MANUAL",
        },
      });
      void runAutomationsForEvent({
        type: "CRM_LEAD_CREATED",
        storeId: access.store.id,
        data: { leadId: lead.id, name: lead.name, email: lead.email ?? undefined },
      });
    }
    imported += 1;
  }

  revalidatePath("/store/marketing");
  revalidatePath(`/store/${slug}/admin/apps/crm`);
  return { success: true, data: { imported, skipped: contacts.length - imported } };
}
