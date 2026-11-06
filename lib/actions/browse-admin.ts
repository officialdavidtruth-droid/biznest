"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";
import { notifyUser } from "@/lib/notifications/notify";
import type { ActionResult } from "@/types/actions";

async function assertPlatformStaff() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  return (await verifyAdminSession(token)) ? { success: true as const } : { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
}

export type BrowseReportGroup = {
  targetKey: string;
  kind: "post" | "comment" | "story";
  postId: string | null;
  commentId: string | null;
  storeName: string;
  storeSlug: string;
  caption: string;
  commentBody: string | null;
  images: string[];
  reasons: Record<string, number>;
  count: number;
  status: string;
  firstAt: string;
};

export async function listBrowseReports(status: "OPEN" | "RESOLVED" = "OPEN"): Promise<BrowseReportGroup[]> {
  const g = await assertPlatformStaff();
  if (!g.success) return [];
  const reports = await prisma.browseReport.findMany({
    where: status === "OPEN" ? { status: "OPEN" } : { status: { not: "OPEN" } },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      post: { select: { caption: true, images: true, store: { select: { name: true, slug: true } } } },
      story: { select: { text: true, imageUrl: true, store: { select: { name: true, slug: true } } } },
    },
  });
  const commentIds = [...new Set(reports.map((r) => r.commentId).filter((x): x is string => !!x))];
  const comments = commentIds.length ? await prisma.browseComment.findMany({ where: { id: { in: commentIds } }, select: { id: true, body: true } }) : [];
  const bodyOf = new Map(comments.map((c) => [c.id, c.body]));

  const groups = new Map<string, BrowseReportGroup>();
  for (const r of reports) {
    const ex = groups.get(r.targetKey);
    if (ex) {
      ex.count++;
      ex.reasons[r.reason] = (ex.reasons[r.reason] ?? 0) + 1;
      if (r.createdAt.toISOString() < ex.firstAt) ex.firstAt = r.createdAt.toISOString();
      continue;
    }
    const holder = r.post ?? null;
    const storeInfo = holder?.store ?? r.story?.store;
    if (!storeInfo) continue; // target was deleted meanwhile
    groups.set(r.targetKey, {
      targetKey: r.targetKey, kind: r.storyId ? "story" : r.commentId ? "comment" : "post", postId: r.postId, commentId: r.commentId,
      storeName: storeInfo.name, storeSlug: storeInfo.slug, caption: holder?.caption ?? r.story?.text ?? "", commentBody: r.commentId ? bodyOf.get(r.commentId) ?? null : null,
      images: holder?.images ?? (r.story?.imageUrl ? [r.story.imageUrl] : []), reasons: { [r.reason]: 1 }, count: 1, status: r.status, firstAt: r.createdAt.toISOString(),
    });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/** UPHOLD removes the post / hides the comment; DISMISS keeps it (and restores it if reports had auto-hidden it). */
export async function resolveBrowseReport(targetKey: string, decision: "UPHOLD" | "DISMISS"): Promise<ActionResult> {
  const g = await assertPlatformStaff();
  if (!g.success) return { success: false, error: g.error };
  const sample = await prisma.browseReport.findFirst({ where: { targetKey, status: "OPEN" }, select: { postId: true, commentId: true, storyId: true } });
  if (!sample) return { success: false, error: "Nothing open for this item." };
  const { postId, commentId, storyId } = sample;

  if (storyId) {
    await prisma.browseStory.updateMany({
      where: decision === "UPHOLD" ? { id: storyId } : { id: storyId, status: "HIDDEN" },
      data: { status: decision === "UPHOLD" ? "REMOVED" : "ACTIVE" },
    });
    await prisma.browseReport.updateMany({ where: { targetKey, status: "OPEN" }, data: { status: decision === "UPHOLD" ? "UPHELD" : "DISMISSED" } });
    revalidatePath("/supaadmin/browse-reports");
    revalidatePath("/browse");
    return { success: true, data: undefined };
  }
  if (!postId) return { success: false, error: "Nothing to resolve." };

  if (decision === "UPHOLD") {
    if (commentId) {
      const c = await prisma.browseComment.findUnique({ where: { id: commentId }, select: { status: true } });
      if (c?.status === "VISIBLE") {
        await prisma.$transaction([
          prisma.browseComment.update({ where: { id: commentId }, data: { status: "HIDDEN" } }),
          prisma.browsePost.update({ where: { id: postId }, data: { commentCount: { decrement: 1 } } }),
        ]);
      }
    } else {
      const post = await prisma.browsePost.update({
        where: { id: postId }, data: { status: "REMOVED", hiddenReason: "ADMIN" },
        select: { store: { select: { slug: true, business: { select: { user: { select: { id: true } } } } } } },
      });
      const ownerId = post.store.business?.user?.id;
      if (ownerId) await notifyUser({ userId: ownerId, type: "BROWSE_REMOVED", title: "A Browse post was removed", body: "It was reported and BizNest staff found it broke the rules.", url: `/store/${post.store.slug}/admin/browse` }).catch(() => undefined);
    }
  } else if (!commentId) {
    await prisma.browsePost.updateMany({ where: { id: postId, status: "HIDDEN", hiddenReason: "REPORTS" }, data: { status: "PUBLISHED", hiddenReason: null } });
  } else {
    const c = await prisma.browseComment.findUnique({ where: { id: commentId }, select: { status: true } });
    if (c?.status === "HIDDEN") {
      await prisma.$transaction([
        prisma.browseComment.update({ where: { id: commentId }, data: { status: "VISIBLE" } }),
        prisma.browsePost.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
      ]);
    }
  }
  await prisma.browseReport.updateMany({ where: { targetKey, status: "OPEN" }, data: { status: decision === "UPHOLD" ? "UPHELD" : "DISMISSED" } });
  revalidatePath("/supaadmin/browse-reports");
  revalidatePath("/browse");
  return { success: true, data: undefined };
}
