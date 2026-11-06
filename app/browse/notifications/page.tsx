import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/browse";
import { BROWSE_NOTIFY_TYPES } from "@/lib/browse-notify";
import { BrowseShell } from "@/components/browse/browse-shell";
import { BrowsePushPrompt } from "@/components/browse/push-prompt";
import { MarkRead } from "@/components/browse/mark-read";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alerts — BizNest Browse", robots: { index: false } };

const display = "font-[family-name:var(--font-browse-display)]";

export default async function BrowseNotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fbrowse%2Fnotifications");
  const rows = await prisma.notification.findMany({
    where: { userId: session.user.id, type: { in: [...BROWSE_NOTIFY_TYPES] } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, url: true, readAt: true, createdAt: true },
  });
  const hasUnread = rows.some((r: { readAt: Date | null }) => !r.readAt);

  return (
    <BrowseShell back={{ href: "/browse", label: "Browse" }}>
      <main className="mx-auto max-w-[600px] px-4 pb-20 pt-6">
        <h1 className={`${display} mb-5 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl`}>Alerts</h1>
        <BrowsePushPrompt />
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.06] p-6 text-center text-[15px] text-[#FBF6E9]/80">
            Nothing yet. When a business you follow posts, it shows up here. <Link href="/browse" className="underline">Find businesses to follow</Link>.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r: { id: string; title: string; body: string; url: string | null; readAt: Date | null; createdAt: Date }) => (
              <li key={r.id}>
                <Link href={r.url ?? "/browse"} className={`block rounded-2xl p-4 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E] ${r.readAt ? "bg-white/[0.04]" : "bg-white/[0.12]"}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{r.title}</span>
                    <span className="shrink-0 text-xs text-[#FBF6E9]/60">{timeAgo(r.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-[#FBF6E9]/80">{r.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <MarkRead hasUnread={hasUnread} />
      </main>
    </BrowseShell>
  );
}
