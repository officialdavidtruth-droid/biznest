import Link from "next/link";
import { ArrowLeft, Search, Store } from "lucide-react";
import { browseDisplay } from "@/lib/browse-font";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BROWSE_NOTIFY_TYPES } from "@/lib/browse-notify";
import { AccountMenu } from "@/components/browse/account-menu";

/** Page chrome for every Browse page: green market-board backdrop plus a sticky header. */
export async function BrowseShell({ children, back }: { children: React.ReactNode; back?: { href: string; label: string } }) {
  const session = await auth().catch(() => null);
  const u = session?.user;
  const unread = u?.id
    ? await prisma.notification.count({ where: { userId: u.id, type: { in: [...BROWSE_NOTIFY_TYPES] }, readAt: null } }).catch(() => 0)
    : 0;
  return (
    <div
      className={`${browseDisplay.variable} min-h-screen text-[#FBF6E9]`}
      style={{
        colorScheme: "dark",
        background:
          "radial-gradient(900px 420px at 12% -8%, rgba(46,125,70,.55), transparent 62%), radial-gradient(700px 360px at 100% 0%, rgba(245,184,46,.10), transparent 60%), radial-gradient(rgba(255,255,255,.045) 1px, transparent 1.5px) 0 0 / 22px 22px, #0A2012",
      }}
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0A2012]/75 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          {back ? (
            <Link href={back.href} className="inline-flex items-center gap-2 rounded-full py-1.5 pr-3 text-sm font-medium text-[#FBF6E9]/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {back.label}
            </Link>
          ) : (
            <Link href="/browse" className="inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#F5B82E] text-[#14301A]"><Store className="h-4 w-4" aria-hidden /></span>
              <span className="font-[family-name:var(--font-browse-display)] text-xl font-extrabold tracking-tight">Browse</span>
            </Link>
          )}
          <nav aria-label="Browse" className="flex items-center gap-1.5 text-sm">
            <Link href="/search" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-medium hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]">
              <Search className="h-4 w-4" aria-hidden /> Find businesses
            </Link>
            <AccountMenu unread={unread} signedIn={!!u?.id} isMember={u?.role === "MEMBER"} hasStore={!!u?.storeSlug} />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
