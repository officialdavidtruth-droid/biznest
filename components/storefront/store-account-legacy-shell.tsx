import type React from "react";
import Link from "next/link";
import { ArrowLeft, Menu } from "lucide-react";
import { getAccountCopy } from "@/lib/account-copy";
import { VelouraAccountNav } from "@/components/storefront/veloura-account-nav";

export function StoreAccountLegacyShell({ children, slug, store, membership, unreadMessageCount, nav }: any) {
  // Same reasoning as SignatureCustomerShell: only show Orders/Addresses
  // for stores that sell products, and Bookings for stores that offer
  // services, so a pure-service or pure-product store's sidebar doesn't
  // show links to a feature it has no data for. Wording (Orders vs
  // Invoices vs Purchases, Bookings vs Reservations vs Projects) comes
  // from the store's business category via getAccountCopy, the same
  // source of truth the Signature templates use, so a legacy-template
  // hotel says "Reservations" instead of the generic "My Appointments".
  const copy = getAccountCopy(null, store.businessCategory);
  const LINKS = [
    { key: "account", href: `/store/${slug}/account`, label: copy.account, iconKey: "LayoutDashboard" },
    ...(nav.sellsProducts ? [{ key: "orders", href: `/store/${slug}/orders`, label: copy.orders, iconKey: "Package" }] : []),
    { key: "wishlist", href: `/store/${slug}/account/wishlist`, label: copy.wishlist, iconKey: "Heart" },
    ...(nav.sellsProducts ? [{ key: "addresses", href: `/store/${slug}/account/addresses`, label: "Addresses", iconKey: "MapPin" }] : []),
    { key: "rewards", href: `/store/${slug}/account/loyalty`, label: "Rewards", iconKey: "Bell" },
    { key: "payments", href: `/store/${slug}/account/wallet`, label: "Wallet", iconKey: "Wallet" },
    ...(nav.offersServices ? [{ key: "bookings", href: `/store/${slug}/account/bookings`, label: copy.bookings, iconKey: "CalendarDays" }] : []),
    { key: "reviews", href: `/store/${slug}/account/reviews`, label: "My Reviews", iconKey: "Star" },
    { key: "messages", href: `/store/${slug}/account/messages`, label: "Support & Disputes", iconKey: "MessageCircle", badge: unreadMessageCount },
  ];

  const colors = (store.themeColors as any) ?? {};
  // Legacy (non-Signature) stores only ever stored primary/background/text --
  // there's no card/muted/border/radius/font set here the way the 13
  // Signature templates have, so we derive sensible ones from what exists
  // rather than leaving them hardcoded black-and-white like before. This
  // reuses the exact same --sig-* variables and .signature-account* classes
  // the Signature shell uses (see signature-customer-shell.tsx and
  // SIGNATURE_CUSTOMER_EXPERIENCE.css) so every store gets real themed
  // chrome here, not just the 13 Signature templates.
  const accent = colors.primary || "#111827";
  const bg = colors.background || "#f8fafc";
  const ink = colors.text || "#0f172a";
  const css = {
    "--sig-bg": bg,
    "--sig-ink": ink,
    "--sig-card": "#ffffff",
    "--sig-accent": accent,
    "--sig-muted": `${ink}99`,
    "--sig-border": `${ink}1a`,
    "--sig-radius": "16px",
    "--sig-font": store.fontFamily || undefined,
    "--sig-headline": store.fontFamily || undefined,
  } as React.CSSProperties;

  return (
    <div className="signature-account min-h-screen" style={css}>
      <header className="signature-account-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/store/${slug}`} className="signature-account-back" aria-label="Back to store"><ArrowLeft className="h-4 w-4" /></Link>
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} className="signature-account-logo" /> : <div className="signature-account-logo-fallback">{store.name.charAt(0).toUpperCase()}</div>}
            <div className="min-w-0"><p className="signature-eyebrow truncate">My {store.name} Account</p><p className="truncate text-sm opacity-60">Signed in as {membership.user.email ?? membership.user.name}</p></div>
          </div>
          <span className="signature-account-mobile-label"><Menu className="h-4 w-4" /> Account</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-7 px-5 py-6 md:px-8 md:py-10 lg:grid-cols-[250px_minmax(0,1fr)]">
        <VelouraAccountNav slug={slug} unread={unreadMessageCount} links={LINKS as any} />
        <div className="signature-account-content min-w-0">{children}</div>
      </div>
    </div>
  );
}
