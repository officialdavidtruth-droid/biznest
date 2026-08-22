import type { Metadata } from "next";
import { getStoreBranding } from "@/lib/actions/store-branding";

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
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
