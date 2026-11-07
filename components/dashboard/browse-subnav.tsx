"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Feed" },
  { href: "/posts", label: "My posts" },
  { href: "/activity", label: "Activity" },
  { href: "/insights", label: "Insights" },
];

/** Tabs along the top of every Browse page in the dashboard. Ads has its own page, linked at the end. */
export function BrowseSubnav({ slug, unread }: { slug: string; unread: number }) {
  const pathname = usePathname();
  const base = `/store/${slug}/admin/browse`;
  const tabClass = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`;
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Browse sections">
      {TABS.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link key={t.label} href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
            {t.label}{t.label === "Activity" && unread > 0 ? ` (${unread})` : ""}
          </Link>
        );
      })}
      <Link href={`/store/${slug}/admin/ads`} className={tabClass(false)}>Ads</Link>
    </nav>
  );
}
