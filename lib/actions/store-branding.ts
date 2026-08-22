import { prisma } from "@/lib/prisma";

export type StoreBranding = {
  name: string;
  logoUrl: string | null;
  themeColors: { primary?: string } | null;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: { instagram?: string; facebook?: string; twitter?: string; tiktok?: string; whatsapp?: string } | null;
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
    select: { name: true, logoUrl: true, themeColors: true, contactEmail: true, contactPhone: true, socialLinks: true },
  });
  return store as StoreBranding;
}
