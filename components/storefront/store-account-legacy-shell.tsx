import Link from "next/link";
import { LayoutDashboard, Package, Heart, MapPin, Bell, Calendar, Star, MessageSquare, ArrowLeft, LogOut, Wallet } from "lucide-react";
import { SignOutButton } from "@/components/forms/sign-out-button";

export function StoreAccountLegacyShell({ children, slug, store, membership, unreadMessageCount }: any) {
  const LINKS = [
    { href: `/store/${slug}/account`, label: "My Account", icon: LayoutDashboard },
    { href: `/store/${slug}/orders`, label: "My Orders", icon: Package },
    { href: `/store/${slug}/account/wishlist`, label: "My Wishlist", icon: Heart },
    { href: `/store/${slug}/account/addresses`, label: "My Addresses", icon: MapPin },
    { href: `/store/${slug}/account/loyalty`, label: "My Rewards", icon: Bell },
    { href: `/store/${slug}/account/wallet`, label: "My Wallet", icon: Wallet },
    { href: `/store/${slug}/account/bookings`, label: "My Appointments", icon: Calendar },
    { href: `/store/${slug}/account/reviews`, label: "My Reviews", icon: Star },
    { href: `/store/${slug}/account/messages`, label: "Support & Disputes", icon: MessageSquare, badge: unreadMessageCount },
  ];
  const colors = (store.themeColors as any) ?? {};
  const accent = colors.primary || "#111827", background = colors.background || "#f8fafc", ink = colors.text || "#0f172a";
  return <div className="min-h-screen" style={{ ["--store-accent" as string]: accent, backgroundColor: background, color: ink }}><div className="mx-auto max-w-6xl px-6 py-10"><div className="mb-6 flex items-center gap-3"><Link href={`/store/${slug}`} className="flex h-9 w-9 items-center justify-center rounded-full border bg-white"><ArrowLeft className="h-4 w-4" /></Link>{store.logoUrl && <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded-lg object-cover" />}<div><p className="text-xs font-medium uppercase tracking-wide" style={{ color: accent }}>My {store.name} Account</p><p className="text-sm opacity-60">Signed in as {membership.user.email ?? membership.user.name}</p></div></div><div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]"><nav className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 md:flex-col">{LINKS.map(({ href, label, icon: Icon, badge }: any) => <Link key={href} href={href} className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium opacity-70 hover:opacity-100"><Icon className="h-4 w-4" />{label}{!!badge && <span className="ml-auto">{badge > 9 ? "9+" : badge}</span>}</Link>)}<SignOutButton callbackUrl={`/store/${slug}`} className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600"><LogOut className="h-4 w-4" />Sign out</SignOutButton></nav><div className="min-w-0">{children}</div></div></div></div>;
}
