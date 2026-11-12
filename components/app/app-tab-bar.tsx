"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Home, Search, ShoppingCart, ClipboardList, User } from "lucide-react";
import { RESERVED_SLUGS } from "@/lib/constants/reserved-slugs";
import { useCart } from "@/lib/cart-context";

/** Splits "/store/acme/cart" or "/acme/cart" into { slug: "acme", base, rest }. */
function parseStorePath(pathname: string): { slug: string; base: string; rest: string } | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  let slug: string;
  let base: string;
  let restParts: string[];
  if (parts[0] === "store" && parts[1]) {
    slug = parts[1]; base = `/store/${slug}`; restParts = parts.slice(2);
  } else if (!RESERVED_SLUGS.has(parts[0])) {
    slug = parts[0]; base = `/${slug}`; restParts = parts.slice(1);
  } else return null;
  return { slug, base, rest: restParts.length ? `/${restParts.join("/")}` : "" };
}

const HIDE = /^\/(admin|checkout|payment|wallet-pay|login|register|forgot-password|reset-password|booking|book)(\/|$)/;

/**
 * Native-style bottom tab bar for storefront pages, shown only inside the
 * BizNest app. The merchant dashboard has its own bar, so it is hidden there.
 */
export function AppTabBar() {
  const pathname = usePathname() ?? "";
  const { items } = useCart();
  const parsed = parseStorePath(pathname);
  // The bottom tab bar is a phone pattern; the desktop app keeps the storefront's own header.
  const isDesktopApp = typeof navigator !== "undefined" && navigator.userAgent.includes("BizNestDesktop");
  const visible = !!parsed && !HIDE.test(parsed.rest) && !isDesktopApp;

  useEffect(() => {
    document.documentElement.toggleAttribute("data-tabbar", visible);
    return () => document.documentElement.removeAttribute("data-tabbar");
  }, [visible]);

  if (!parsed || !visible) return null;

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const tabs = [
    { href: parsed.base, label: "Home", icon: Home, match: (r: string) => r === "" },
    { href: `${parsed.base}/search`, label: "Search", icon: Search, match: (r: string) => r.startsWith("/search") },
    { href: `${parsed.base}/cart`, label: "Cart", icon: ShoppingCart, match: (r: string) => r.startsWith("/cart"), badge: count },
    { href: `${parsed.base}/orders`, label: "Orders", icon: ClipboardList, match: (r: string) => r.startsWith("/orders") },
    { href: `${parsed.base}/account`, label: "Account", icon: User, match: (r: string) => r.startsWith("/account") },
  ];
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.match(parsed.rest)));
  const anyActive = tabs.some((t) => t.match(parsed.rest));

  return (
    <nav className="bn-tabbar" aria-label="Main">
      {anyActive && <span className="bn-tabbar-pill" style={{ transform: `translateX(${activeIndex * 100}%)` }} />}
      {tabs.map((t, i) => {
        const active = anyActive && i === activeIndex;
        const Icon = t.icon;
        return (
          <Link key={t.label} href={t.href} className={`bn-tab ${active ? "bn-tab-active" : ""}`} aria-current={active ? "page" : undefined}>
            <span className="bn-tab-icon">
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} />
              {!!t.badge && <span key={t.badge} className="bn-tab-badge">{t.badge > 99 ? "99+" : t.badge}</span>}
            </span>
            <span className="bn-tab-label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
