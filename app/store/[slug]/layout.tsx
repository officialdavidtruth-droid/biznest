import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { StoreMenuProvider } from "@/components/storefront/store-menu";
import { StoreCategoriesProvider } from "@/components/storefront/store-categories";
import { resolveMenuRows } from "@/lib/storefront-menu";
import { resolveStoreTheme } from "@/lib/template-themes";
import { PromoPopup } from "@/components/storefront/promo-popup";
import { buildPromoPalette, isPromoLive, readPromoPopup } from "@/lib/storefront/promo-popup";
import { getPluginEntitlement } from "@/lib/plugins";
import { WhatsAppChatButton } from "@/components/storefront/whatsapp-chat-button";
import { whatsappLink } from "@/lib/utils/whatsapp-link";

// Every store page under /store/[slug] falls back to the root layout's
// static "BizNest — Build, Sell, Grow" <title> and platform favicon unless
// overridden here -- that's why the browser tab kept showing "BizNest"
// (title + icon) instead of the store's own name/logo on every storefront
// page (home, orders, account, etc). "any" for sizes rather than a fixed
// number since a vendor-uploaded logo could be any dimension; apple-touch-
// icon covers "Add to Home Screen" on iOS too, not just the browser tab.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  if (!store) return {};
  return {
    title: store.name,
    icons: store.logoUrl
      ? {
          icon: [{ url: store.logoUrl, sizes: "any" }],
          apple: [{ url: store.logoUrl }],
          shortcut: [{ url: store.logoUrl }],
        }
      : undefined,
  };
}

// Lumina design system typefaces — headlines in Plus Jakarta Sans, body/UI
// in Inter (see lib/template-themes.ts LUMINA.font / LUMINA.headlineFont) —
// plus the extra body-font options offered in Settings > Typography
// (see app/store/[slug]/admin/settings/page.tsx). Next.js hoists <link>
// tags found anywhere in the tree into <head>, so declaring them once here
// covers every storefront page under /store/[slug] (home, cart, checkout)
// without each page re-declaring it. Georgia/Courier New are system fonts
// and need no webfont link.
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // If this slug doesn't match any store directly, it might be one an
  // owner retired by shortening/renaming their store URL (see
  // updateStoreSlug in lib/actions/store.ts). Only one extra query, and
  // only in that (rare) case — the common case of a live slug costs
  // nothing extra here since every route under this layout already does
  // its own store lookup and 404s on a genuine miss.
  const exists = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      // Promo pop-up card: config + the fields resolveStoreTheme needs so the
      // card is painted in whichever template this store uses.
      status: true,
      name: true,
      socialLinks: true,
      storefrontConfig: true,
      themeColors: true,
      fontFamily: true,
      template: { select: { name: true, category: true } },
      // Real categories for storefront navigation (mega menu, category pages).
      categories: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, parentId: true, description: true, imageUrl: true, _count: { select: { products: { where: { isPublished: true } }, services: { where: { isPublished: true } } } } },
      },
      // Owner-built header menu (Dashboard > Menus). Empty = templates use their own default links.
      menuItems: {
        where: { location: "header", isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, linkType: true, target: true, openInNewTab: true, parentId: true, sortOrder: true },
      },
    },
  });
  if (!exists) {
    const retired = await prisma.storeSlugHistory.findUnique({
      where: { oldSlug: slug },
      select: { store: { select: { slug: true } } },
    });
    if (retired) {
      // Preserve whatever came after the slug (e.g. "/admin/settings",
      // "/checkout") using the header middleware forwards for exactly
      // this — without it, this redirect could only ever land on the new
      // slug's bare storefront root, which silently bounced an owner out
      // of a still-bookmarked /admin link onto their own public
      // storefront homepage instead of back into the dashboard.
      const subpath = (await headers()).get("x-bn-store-subpath") ?? "/";
      redirect(`/${retired.store.slug}${subpath === "/" ? "" : subpath}`);
    }
  }

  // One mount point for every template (builder, legacy, signature, dedicated
  // renderers): the popup lives in the layout and takes its look from the
  // resolved theme, so new templates are covered automatically.
  const promo = exists ? readPromoPopup(exists.storefrontConfig) : null;
  let showPromo = !!exists && exists.status === "ACTIVE" && !!promo && isPromoLive(promo);
  if (showPromo) {
    // Promo pop-up belongs to the Marketing tool (CRM & Sales app). If the app is
    // uninstalled or the plan lapses, stop showing the card. Only runs when a
    // popup is actually enabled, so other storefronts pay nothing extra.
    const ent = await getPluginEntitlement(exists!.id, "crm");
    showPromo = ent.allowed && !!ent.installed;
  }
  const promoPalette = showPromo
    ? buildPromoPalette(
        resolveStoreTheme(
          exists!.template?.category,
          exists!.name,
          exists!.themeColors as { primary?: string; secondary?: string; accent?: string } | null,
          exists!.fontFamily,
          exists!.template?.name
        ),
        exists!.template?.name
      )
    : null;

  // Opt-in floating chat button -> the vendor's own WhatsApp number.
  const social = (exists?.socialLinks && typeof exists.socialLinks === "object" ? exists.socialLinks : {}) as Record<string, string | undefined>;
  const chatHref = exists && exists.status === "ACTIVE" && social.whatsappFloat === "on" ? whatsappLink(social.whatsapp, `Hi ${exists.name}!`) : null;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        rel="stylesheet"
      />
      <StoreCategoriesProvider categories={(exists?.categories ?? []).map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, description: c.description, imageUrl: c.imageUrl, count: c._count.products + c._count.services }))}>
        <StoreMenuProvider menu={exists?.menuItems?.length ? resolveMenuRows(exists.menuItems, slug) : null}>{children}</StoreMenuProvider>
      </StoreCategoriesProvider>
      {chatHref && exists && <WhatsAppChatButton href={chatHref} storeName={exists.name} />}
      {showPromo && promo && promoPalette && <PromoPopup slug={slug} config={promo} palette={promoPalette} />}
    </>
  );
}
