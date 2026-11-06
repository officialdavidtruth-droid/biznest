"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isPlatformStaff } from "@/lib/admin-guard";
import { BIO_MAX, OFFICIAL_BIO, OFFICIAL_NAME, OFFICIAL_SLUG, safeHttpsImage } from "@/lib/browse";
import type { ActionResult } from "@/types/actions";

const OFFICIAL_EMAIL = "official@biznest.space";
const NOT_ALLOWED = "Admin PIN session expired or invalid. Please sign in again.";

/**
 * Creates BizNest's own Browse account if it doesn't exist yet: a login-less owner user, an approved and
 * verified business, and a store row (no storefront) to hang posts, stories and followers on. Safe to run twice.
 */
export async function ensureOfficialAccount(): Promise<ActionResult<{ slug: string }>> {
  if (!(await isPlatformStaff())) return { success: false, error: NOT_ALLOWED };
  const existing = await prisma.store.findUnique({ where: { slug: OFFICIAL_SLUG }, select: { id: true } });
  if (existing) return { success: true, data: { slug: OFFICIAL_SLUG } };

  const user = (await prisma.user.findFirst({ where: { email: OFFICIAL_EMAIL, customerScopeStoreId: null, isMarketingOnly: false }, select: { id: true } }))
    ?? (await prisma.user.create({ data: { name: OFFICIAL_NAME, email: OFFICIAL_EMAIL, role: "STORE_OWNER", customerScopeStoreId: null, emailVerified: new Date() }, select: { id: true } }));
  // No password: nobody can sign in as this user. Only SupaAdmin staff manage the account.

  const business = (await prisma.business.findUnique({ where: { userId: user.id }, select: { id: true } }))
    ?? (await prisma.business.create({
      data: {
        userId: user.id, businessName: OFFICIAL_NAME, category: "Platform", description: OFFICIAL_BIO,
        phone: "+2340000000000", email: OFFICIAL_EMAIL, country: "Nigeria", state: "FCT", city: "Abuja",
        registrationType: "REGISTERED", verificationStatus: "APPROVED", verificationBadge: true, searchVisible: true,
      },
      select: { id: true },
    }));
  try {
    await prisma.store.create({ data: { businessId: business.id, name: OFFICIAL_NAME, slug: OFFICIAL_SLUG, businessType: "Platform", status: "ACTIVE", marketingOnly: true } });
  } catch {
    return { success: false, error: "Couldn't create the account. The name biznest-official may already be taken by another store." };
  }
  revalidatePath("/supaadmin/official");
  revalidatePath("/browse");
  return { success: true, data: { slug: OFFICIAL_SLUG } };
}

/** Name, bio (the business description shown on the profile) and logo of the official account. */
export async function updateOfficialProfile(input: { name?: string; bio?: string; logoUrl?: string | null }): Promise<ActionResult> {
  if (!(await isPlatformStaff())) return { success: false, error: NOT_ALLOWED };
  const store = await prisma.store.findUnique({ where: { slug: OFFICIAL_SLUG }, select: { id: true, businessId: true } });
  if (!store) return { success: false, error: "Set up the BizNest official account first." };
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const bio = String(input.bio ?? "").trim().slice(0, BIO_MAX);
  if (name.length < 2) return { success: false, error: "Enter a name (at least 2 letters)." };
  if (bio.length < 10) return { success: false, error: "Write a short bio (at least 10 characters)." };
  const logoUrl = input.logoUrl ? safeHttpsImage(input.logoUrl) : null;
  if (input.logoUrl && !logoUrl) return { success: false, error: "The logo must be an https image." };
  await prisma.$transaction([
    prisma.store.update({ where: { id: store.id }, data: { name, logoUrl } }),
    prisma.business.update({ where: { id: store.businessId }, data: { businessName: name, description: bio } }),
  ]);
  revalidatePath("/supaadmin/official");
  revalidatePath(`/browse/s/${OFFICIAL_SLUG}`);
  revalidatePath("/browse");
  return { success: true, data: undefined };
}
