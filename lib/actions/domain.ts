"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { addDomainToVercel, checkDomainStatus, removeDomainFromVercel } from "@/lib/vercel-domains";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";

// Custom domain lives under store Settings ("settings" permission in
// dashboard-nav.ts). assertStorePermission's store doesn't include
// `subscription` (needed here for plan-gating custom domains), so fetch it
// alongside the permission check.
async function assertStoreAccess(slug: string) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;

  const withSubscription = await prisma.store.findUnique({
    where: { id: access.store.id },
    include: { subscription: true },
  });
  return { success: true as const, store: { ...access.store, subscription: withSubscription?.subscription ?? null } };
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

export async function setCustomDomain(slug: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const features = access.store.subscription?.features as { customDomain?: boolean } | null;
  if (!features?.customDomain) {
    return { success: false, error: "Custom domains require the Enterprise plan or above. Upgrade to unlock this." };
  }

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) {
    return { success: false, error: "Enter a valid domain, e.g. mystore.com (no https:// or www)." };
  }

  const taken = await prisma.store.findFirst({ where: { customDomain: domain, id: { not: access.store.id } } });
  if (taken) return { success: false, error: "That domain is already connected to another store." };

  const result = await addDomainToVercel(domain);
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  await prisma.store.update({
    where: { id: access.store.id },
    data: { customDomain: domain, customDomainStatus: result.verified ? "VERIFIED" : "PENDING" },
  });

  revalidatePath(`/store/${slug}/admin/settings`);
  return { success: true, data: undefined };
}

/** Re-checks Vercel's verification status — useful right after the vendor updates their DNS. */
export async function recheckDomainStatus(slug: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  if (!access.store.customDomain) return { success: false, error: "No domain is set." };

  const result = await checkDomainStatus(access.store.customDomain);
  if (!result.ok) return { success: false, error: result.error };

  await prisma.store.update({
    where: { id: access.store.id },
    data: { customDomainStatus: result.verified ? "VERIFIED" : "PENDING" },
  });

  revalidatePath(`/store/${slug}/admin/settings`);
  return { success: true, data: undefined };
}

export async function removeCustomDomain(slug: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  if (!access.store.customDomain) return { success: true, data: undefined };

  await removeDomainFromVercel(access.store.customDomain);
  await prisma.store.update({
    where: { id: access.store.id },
    data: { customDomain: null, customDomainStatus: "NONE" },
  });

  revalidatePath(`/store/${slug}/admin/settings`);
  return { success: true, data: undefined };
}
