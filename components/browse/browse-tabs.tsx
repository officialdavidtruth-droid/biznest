import Link from "next/link";

const TABS = [
  { id: "foryou", href: "/browse", label: "For you" },
  { id: "following", href: "/browse/following", label: "Following" },
  { id: "reels", href: "/browse/reels", label: "Reels" },
  { id: "saved", href: "/browse/saved", label: "Saved" },
] as const;

export type BrowseTabId = (typeof TABS)[number]["id"];

/** The four ways into Browse, shown at the top of every feed page. */
export function BrowseTabs({ active }: { active: BrowseTabId }) {
  return (
    <nav aria-label="Browse sections" className="mb-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
      {TABS.map((t) => (
        <Link
          key={t.id} href={t.href} aria-current={t.id === active ? "page" : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5B82E] ${t.id === active ? "bg-[#F5B82E] text-[#14301A]" : "bg-white/10 text-[#FBF6E9]/90 hover:bg-white/15"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
