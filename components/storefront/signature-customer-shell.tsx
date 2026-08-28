import Link from "next/link";
import { ArrowLeft, LayoutDashboard, Package, Heart, MapPin, Bell, Calendar, Star, MessageSquare, LogOut, Wallet, Menu } from "lucide-react";
import { getSignatureTheme } from "@/lib/template-themes";
import { SignOutButton } from "@/components/forms/sign-out-button";

type Props = { children: React.ReactNode; slug: string; templateName: string; storeName: string; logoUrl: string | null; email?: string | null; unreadMessageCount: number; nav: { sellsProducts: boolean; offersServices: boolean } };

const labels: Record<string, { orders: string; bookings: string; wishlist: string; account: string }> = {
  electra: { orders: "Orders", bookings: "Bookings", wishlist: "Wishlist", account: "My account" }, atelier: { orders: "Purchases", bookings: "Appointments", wishlist: "Saved pieces", account: "My atelier" }, kinetic: { orders: "Orders", bookings: "Bookings", wishlist: "Saved kicks", account: "My account" }, bloom: { orders: "Orders", bookings: "Appointments", wishlist: "Saved beauty", account: "My account" }, haven: { orders: "Orders", bookings: "Deliveries", wishlist: "Saved home", account: "My home" }, harvest: { orders: "Orders", bookings: "Deliveries", wishlist: "Saved groceries", account: "My account" }, maison: { orders: "Purchases", bookings: "My stays", wishlist: "Saved stays", account: "Guest account" }, hotel: { orders: "Purchases", bookings: "Reservations", wishlist: "Saved stays", account: "Guest account" }, ember: { orders: "Orders", bookings: "Reservations", wishlist: "Saved", account: "My account" }, muse: { orders: "Orders", bookings: "Appointments", wishlist: "Saved services", account: "Client account" }, frame: { orders: "Orders", bookings: "My sessions", wishlist: "Saved", account: "Client portal" }, north: { orders: "Invoices", bookings: "Projects", wishlist: "Saved", account: "Client portal" }, pure: { orders: "Orders", bookings: "My cleans", wishlist: "Saved", account: "My account" }, forge: { orders: "Orders", bookings: "Projects", wishlist: "Saved", account: "Project portal" },
};

export function SignatureCustomerShell({ children, slug, templateName, storeName, logoUrl, email, unreadMessageCount, nav }: Props) {
  const theme = getSignatureTheme(templateName);
  const mode = theme.signatureMode;
  const copy = labels[mode] ?? labels.electra;
  // Orders and Bookings are only meaningful if the store actually sells
  // that kind of thing -- a pure service business never has "Orders" (see
  // account/layout.tsx for why), a pure product business never has
  // "Bookings", and a hybrid store (e.g. hotel + restaurant) gets both.
  // Addresses only matters when something physical could ship.
  const links = [
    { href: `/store/${slug}/account`, label: copy.account, icon: LayoutDashboard },
    ...(nav.sellsProducts ? [{ href: `/store/${slug}/orders`, label: copy.orders, icon: Package }] : []),
    { href: `/store/${slug}/account/wishlist`, label: copy.wishlist, icon: Heart },
    ...(nav.sellsProducts ? [{ href: `/store/${slug}/account/addresses`, label: "Addresses", icon: MapPin }] : []),
    { href: `/store/${slug}/account/loyalty`, label: "Rewards", icon: Bell },
    { href: `/store/${slug}/account/wallet`, label: "Wallet", icon: Wallet },
    ...(nav.offersServices ? [{ href: `/store/${slug}/account/bookings`, label: copy.bookings, icon: Calendar }] : []),
    { href: `/store/${slug}/account/reviews`, label: "Reviews", icon: Star },
    { href: `/store/${slug}/account/messages`, label: "Support", icon: MessageSquare, badge: unreadMessageCount },
  ];
  const css = { "--sig-bg": theme.bg, "--sig-ink": theme.ink, "--sig-card": theme.card, "--sig-accent": theme.accent, "--sig-muted": theme.muted, "--sig-border": theme.border, "--sig-dark": theme.surfaceDark, "--sig-radius": theme.radius, "--sig-font": theme.font, "--sig-headline": theme.headlineFont } as React.CSSProperties;

  return <div data-signature-mode={mode} style={css} className="signature-account min-h-screen">
    <header className="signature-account-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/store/${slug}`} className="signature-account-back" aria-label="Back to store"><ArrowLeft className="h-4 w-4" /></Link>
          {logoUrl ? <img src={logoUrl} alt={storeName} className="signature-account-logo" /> : <div className="signature-account-logo-fallback">{storeName.charAt(0).toUpperCase()}</div>}
          <div className="min-w-0"><p className="signature-eyebrow truncate">{storeName}</p><p className="truncate text-sm opacity-60">{email ?? "Customer account"}</p></div>
        </div>
        <span className="signature-account-mobile-label"><Menu className="h-4 w-4" /> Account</span>
      </div>
    </header>
    <div className="mx-auto grid max-w-7xl gap-7 px-5 py-6 md:px-8 md:py-10 lg:grid-cols-[250px_minmax(0,1fr)]">
      <nav className="signature-account-nav">{links.map(({ href, label, icon: Icon, badge }) => <Link key={href} href={href} className="signature-account-nav-link"><Icon className="h-4 w-4" /><span>{label}</span>{!!badge && <b>{badge > 9 ? "9+" : badge}</b>}</Link>)}<div className="signature-account-divider" /><SignOutButton callbackUrl={`/store/${slug}`} className="signature-account-signout"><LogOut className="h-4 w-4" /> Sign out</SignOutButton></nav>
      <main className="signature-account-content">{children}</main>
    </div>
  </div>;
        }
  
