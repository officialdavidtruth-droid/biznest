import { prisma } from "@/lib/prisma";

type ThemeColors = { primary?: string; background?: string; text?: string; accent?: string; secondary?: string };
type SocialLinks = { instagram?: string; facebook?: string; twitter?: string; tiktok?: string; whatsapp?: string };

export type StoreBranding = {
  name: string;
  logoUrl: string | null;
  themeColors: ThemeColors | null;
  fontFamily: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: SocialLinks | null;
  // Onboarding-sourced content, used to make the auth-shell copy (tagline +
  // benefit bullets) reflect this specific business instead of generic
  // marketplace copy. heroOverrides.subtitle (vendor's own click-to-edit
  // wording) wins when set; otherwise callers fall back to business.description.
  businessType: string;
  heroSubtitle: string | null;
  businessCategory: string | null;
  businessDescription: string | null;
  sellsProducts: boolean;
  offersServices: boolean;
} | null;

/**
 * Public-safe store lookup for the shared login/register pages
 * (app/(auth)/**), the store-scoped orders/account pages, and their
 * footer, so a customer sees "Sign in to <Store>" / that store's own
 * accent color + contact details instead of generic BizNest branding.
 * Deliberately not a "use server" action — this is a plain read used
 * during render, not a mutation invoked from a form.
 */
export async function getStoreBranding(slug: string | undefined): Promise<StoreBranding> {
  if (!slug) return null;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      name: true,
      logoUrl: true,
      themeColors: true,
      fontFamily: true,
      contactEmail: true,
      contactPhone: true,
      socialLinks: true,
      businessType: true,
      heroOverrides: true,
      business: {
        select: { category: true, description: true, sellsProducts: true, offersServices: true },
      },
    },
  });
  if (!store) return null;

  const heroOverrides = store.heroOverrides as { subtitle?: string } | null;

  return {
    name: store.name,
    logoUrl: store.logoUrl,
    themeColors: store.themeColors as ThemeColors | null,
    fontFamily: store.fontFamily,
    contactEmail: store.contactEmail,
    contactPhone: store.contactPhone,
    socialLinks: store.socialLinks as SocialLinks | null,
    businessType: store.businessType,
    heroSubtitle: heroOverrides?.subtitle ?? null,
    businessCategory: store.business?.category ?? null,
    businessDescription: store.business?.description ?? null,
    sellsProducts: store.business?.sellsProducts ?? true,
    offersServices: store.business?.offersServices ?? false,
  };
}
