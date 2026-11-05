import type React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAccountCopy } from "@/lib/account-copy";
import { accountThemeStyle } from "@/lib/account-theme";
import { AccountNav, type AccountNavLink } from "@/components/account/account-nav";

/** Account area for every store except the hotel skin: top bar, grouped navigation, themed by the store's accent colour. */
export function StoreAccountLegacyShell({ children, slug, store, membership, unreadMessageCount, nav }: any) {
  // Wording (Orders vs Invoices vs Purchases, Bookings vs Reservations) comes from the store's business category.
  const copy = getAccountCopy(null, store.businessCategory);
  const links: AccountNavLink[] = [
    { key: "account", href: `/store/${slug}/account`, label: copy.account, iconKey: "LayoutDashboard", group: "main" },
    ...(nav.sellsProducts ? [{ key: "orders", href: `/store/${slug}/account/orders`, label: copy.orders, iconKey: "Package" as const, group: "main" as const }] : []),
    ...(nav.offersServices ? [{ key: "bookings", href: `/store/${slug}/account/bookings`, label: copy.bookings, iconKey: "CalendarDays" as const, group: "main" as const }] : []),
    { key: "wishlist", href: `/store/${slug}/account/wishlist`, label: copy.wishlist, iconKey: "Heart", group: "main" },
    ...(nav.sellsProducts ? [{ key: "addresses", href: `/store/${slug}/account/addresses`, label: "Addresses", iconKey: "MapPin" as const, group: "main" as const }] : []),
    { key: "payments", href: `/store/${slug}/account/wallet`, label: "Wallet", iconKey: "Wallet", group: "money" },
    { key: "rewards", href: `/store/${slug}/account/loyalty`, label: "Rewards", iconKey: "Sparkles", group: "money" },
    { key: "giftcards", href: `/store/${slug}/account/gift-cards`, label: "Gift cards", iconKey: "Gift", group: "money" },
    { key: "referrals", href: `/store/${slug}/account/referrals`, label: "Refer a friend", iconKey: "Share2", group: "money" },
    { key: "reviews", href: `/store/${slug}/account/reviews`, label: "My reviews", iconKey: "Star", group: "help" },
    { key: "messages", href: `/store/${slug}/account/messages`, label: "Support & disputes", iconKey: "MessageCircle", group: "help", badge: unreadMessageCount },
  ];
  const style = accountThemeStyle(store.themeColors, store.fontFamily) as React.CSSProperties;

  return (
    <div className="acx" style={style}>
      <header className="acx-top">
        <div className="acx-top-in">
          <Link href={`/store/${slug}`} className="acx-brand" aria-label={`${store.name} home`}>
            {store.logoUrl ? <img src={store.logoUrl} alt="" className="acx-logo" /> : <span className="acx-logo-fallback">{String(store.name).charAt(0).toUpperCase()}</span>}
            <span style={{ minWidth: 0 }}>
              <b>{store.name}</b>
              <small>{membership.user.email ?? membership.user.name}</small>
            </span>
          </Link>
          <Link href={`/store/${slug}`} className="acx-back"><ArrowLeft size={15} /><span>Back to store</span></Link>
        </div>
      </header>
      <div className="acx-wrap">
        <AccountNav slug={slug} links={links} />
        <main className="acx-main">{children}</main>
      </div>
    </div>
  );
}
