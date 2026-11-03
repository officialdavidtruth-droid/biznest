"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp-link";
import { sanitizeHttpUrl } from "@/lib/validations/store-settings";
import { SOCIAL_KEYS, normalizeSocialLink } from "@/lib/storefront/business-details";
import type { ActionResult } from "@/types/actions";

export const BUSINESS_DETAILS_LIMITS = { name: 120, phone: 30, email: 180, address: 300, openingHours: 300 } as const;

const SOCIAL_LABEL = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", twitter: "X (Twitter)" } as const;

/**
 * Saves the "Business details" screen: the few facts every template's header and footer show.
 * Writes the same columns the Settings page already uses (name, logo, contact, social links) plus
 * address and opening hours, so the two screens never disagree.
 */
export async function saveBusinessDetails(slug: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return { success: false, error: access.error };

  const L = BUSINESS_DETAILS_LIMITS;
  const text = (k: string) => String(formData.get(k) ?? "").trim();

  const name = text("name");
  if (!name) return { success: false, error: "Please enter your business name." };
  if (name.length > L.name) return { success: false, error: `Business name must be ${L.name} characters or fewer.` };

  const phone = text("phone") || null;
  if (phone && phone.length > L.phone) return { success: false, error: `Phone number must be ${L.phone} characters or fewer.` };

  const email = text("email") || null;
  if (email && (email.length > L.email || !z.string().email().safeParse(email).success)) {
    return { success: false, error: "That email address doesn't look right." };
  }

  const address = text("address") || null;
  if (address && address.length > L.address) return { success: false, error: `Address must be ${L.address} characters or fewer.` };
  const openingHours = text("openingHours") || null;
  if (openingHours && openingHours.length > L.openingHours) return { success: false, error: `Opening hours must be ${L.openingHours} characters or fewer.` };

  const logoInput = text("logoUrl");
  const logoUrl = logoInput ? sanitizeHttpUrl(logoInput, 1000) : null;
  if (logoInput && !logoUrl) return { success: false, error: "The logo must be an uploaded image. Please upload it again." };

  // WhatsApp: a number (any common format) or a WhatsApp link.
  let whatsapp = "";
  const waInput = text("whatsapp");
  if (waInput) {
    if (/^https?:\/\//i.test(waInput)) {
      const url = sanitizeHttpUrl(waInput);
      if (!url) return { success: false, error: "That WhatsApp link isn't valid." };
      whatsapp = url;
    } else {
      const normalized = normalizeWhatsAppNumber(waInput);
      if (!normalized) return { success: false, error: "Enter your WhatsApp number with its country code, e.g. 0803 123 4567 or +234 803 123 4567." };
      whatsapp = normalized;
    }
  }

  const social: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    const link = normalizeSocialLink(key, text(key));
    if (link === null) return { success: false, error: `Check your ${SOCIAL_LABEL[key]} link or name.` };
    social[key] = link;
  }

  const existing = (access.store.socialLinks && typeof access.store.socialLinks === "object" && !Array.isArray(access.store.socialLinks)
    ? access.store.socialLinks
    : {}) as Record<string, string>;

  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      name,
      logoUrl,
      contactPhone: phone,
      contactEmail: email,
      address,
      openingHours,
      // Merge, don't replace: settings the owner made elsewhere (e.g. the floating WhatsApp button) must survive.
      socialLinks: { ...existing, ...social, whatsapp },
    },
  });

  revalidatePath(`/store/${slug}/admin`, "layout");
  revalidatePath(`/store/${slug}`, "layout");
  return { success: true, data: undefined };
}
