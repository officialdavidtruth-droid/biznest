import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVITY_TYPES } from "@/components/dashboard/browse-tabs";
import { BrowseSubnav } from "@/components/dashboard/browse-subnav";

export const dynamic = "force-dynamic";

/** Shared header and tabs for the Browse section of the dashboard: feed, my posts, activity, insights. */
export default async function BrowseLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await auth();
  if (!s?.user?.id) redirect(`/login?callbackUrl=/${slug}/admin/browse`);
  const exists = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!exists) notFound();
  const unread = await prisma.notification.count({ where: { userId: s.user.id, type: { in: ACTIVITY_TYPES }, readAt: null } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse</h1>
        <p className="mt-1 text-sm text-muted-foreground">See what other businesses are posting, share your own updates, and keep up with likes, comments, followers and how your posts and ads are doing.</p>
      </div>
      <BrowseSubnav slug={slug} unread={unread} />
      {children}
    </div>
  );
}
