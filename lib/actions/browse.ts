"use server";

import { recordPostInterest, recordStoreInterest } from "@/lib/browse-interest";
import { INTEREST_WEIGHT } from "@/lib/browse-foryou";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { getViewer } from "@/lib/browse-viewer";
import { bumpBrowseStat } from "@/lib/browse-stat";
import { BROWSE_REPORT_HIDE_AT, FOLLOW_NEEDS_ACCOUNT, INTERACT_NEEDS_ACCOUNT, REPORT_REASONS, sanitizeComment, type ReportReason } from "@/lib/browse";
import { loadBrowseComments, loadBrowseFeed, loadFollowedStoreIds, loadPostReviews, loadSavedPosts, type PostReviews, loadStorePosts, loadStoreProfile, type BrowseCommentView, type FeedPage, type FeedSort, type GridPost } from "@/lib/browse-data";
import type { ActionResult } from "@/types/actions";

async function ip() {
  return getClientIp(await headers());
}

/**
 * Tells a business owner about a like or follow. Skipped for their own actions, and while an unread alert with the same
 * text is still waiting, so one popular post doesn't flood the bell. Never throws: a failed alert must not fail the tap.
 */
async function notifyOwnerOnce(n: { ownerId?: string | null; actorId?: string | null; type: "BROWSE_LIKE" | "BROWSE_FOLLOW"; title: string; body: string; url: string }) {
  try {
    if (!n.ownerId || n.ownerId === n.actorId) return;
    const waiting = await prisma.notification.findFirst({ where: { userId: n.ownerId, type: n.type, readAt: null, title: n.title, body: n.body }, select: { id: true } });
    if (waiting) return;
    await notifyUser({ userId: n.ownerId, type: n.type, title: n.title, body: n.body, url: n.url });
  } catch {
    /* best effort */
  }
}

async function livePost(postId: string) {
  return prisma.browsePost.findFirst({
    where: { id: postId, status: "PUBLISHED", store: { status: "ACTIVE" } },
    select: { id: true, caption: true, store: { select: { id: true, slug: true, name: true, business: { select: { category: true, user: { select: { id: true } } } } } } },
  });
}

/** Like / unlike. Needs a BizNest account; one like per account per post. */
export async function toggleBrowseLike(postId: string): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  const viewer = await getViewer();
  if (!viewer?.userId) return { success: false, error: INTERACT_NEEDS_ACCOUNT };
  const rl = await checkRateLimit(`browse-like:${await ip()}`, 150, 3_600_000);
  if (!rl.allowed) return { success: false, error: "You're liking very fast. Try again in a bit." };
  const likedPost = await livePost(postId);
  if (!likedPost) return { success: false, error: "This post is no longer available." };

  const result = await prisma.$transaction(async (tx) => {
    const removed = await tx.browseLike.deleteMany({ where: { postId, viewerKey: viewer.key } });
    if (removed.count > 0) {
      const p = await tx.browsePost.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } }, select: { likeCount: true } });
      return { liked: false, likeCount: Math.max(0, p.likeCount) };
    }
    try {
      await tx.browseLike.create({ data: { postId, viewerKey: viewer.key } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const p = await tx.browsePost.findUnique({ where: { id: postId }, select: { likeCount: true } });
        return { liked: true, likeCount: p?.likeCount ?? 0 }; // a parallel tap already liked it
      }
      throw e;
    }
    const p = await tx.browsePost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } }, select: { likeCount: true } });
    return { liked: true, likeCount: p.likeCount };
  });
  if (result.liked) {
    void recordPostInterest(viewer.key, { storeId: likedPost.store.id, category: likedPost.store.business?.category, caption: likedPost.caption }, INTEREST_WEIGHT.LIKE);
    await notifyOwnerOnce({
      ownerId: likedPost.store.business?.user?.id, actorId: viewer.userId, type: "BROWSE_LIKE",
      title: `${viewer.name || "Someone"} liked your Browse post`,
      body: likedPost.caption ? `"${likedPost.caption.replace(/\s+/g, " ").trim().slice(0, 80)}"` : "Your post",
      url: `/store/${likedPost.store.slug}/admin/browse/activity`,
    });
  }
  return { success: true, data: result };
}

/** Follow / unfollow a business. Following needs a BizNest account (a plain member account is enough); the owner can't follow their own business. */
export async function toggleFollowStore(slug: string): Promise<ActionResult<{ following: boolean; followerCount: number }>> {
  const viewer = await getViewer();
  if (!viewer?.userId) return { success: false, error: FOLLOW_NEEDS_ACCOUNT };
  const rl = await checkRateLimit(`browse-follow:${await ip()}`, 120, 3_600_000);
  if (!rl.allowed) return { success: false, error: "You're following very fast. Try again in a bit." };
  const store = await prisma.store.findFirst({
    where: { slug: String(slug).slice(0, 80), status: "ACTIVE", business: { is: { searchVisible: true } } },
    select: { id: true, name: true, slug: true, business: { select: { user: { select: { id: true } } } } },
  });
  if (!store) return { success: false, error: "This business is no longer available." };
  if (store.business?.user?.id === viewer.userId) return { success: false, error: "You can't follow your own business." };

  const result = await prisma.$transaction(async (tx) => {
    const removed = await tx.browseFollow.deleteMany({ where: { storeId: store.id, viewerKey: viewer.key } });
    if (removed.count > 0) {
      const s = await tx.store.update({ where: { id: store.id }, data: { followerCount: { decrement: 1 } }, select: { followerCount: true } });
      return { following: false, followerCount: Math.max(0, s.followerCount) };
    }
    try {
      await tx.browseFollow.create({ data: { storeId: store.id, viewerKey: viewer.key } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const s = await tx.store.findUnique({ where: { id: store.id }, select: { followerCount: true } });
        return { following: true, followerCount: s?.followerCount ?? 0 }; // a parallel tap already followed
      }
      throw e;
    }
    const s = await tx.store.update({ where: { id: store.id }, data: { followerCount: { increment: 1 } }, select: { followerCount: true } });
    return { following: true, followerCount: s.followerCount };
  });
  if (result.following) {
    void recordStoreInterest(viewer.key, store.id, INTEREST_WEIGHT.FOLLOW);
    await notifyOwnerOnce({
      ownerId: store.business?.user?.id, actorId: viewer.userId, type: "BROWSE_FOLLOW",
      title: `${viewer.name || "Someone"} started following ${store.name}`,
      body: "They'll see your new posts in their Following feed.",
      url: `/store/${store.slug}/admin/browse/activity`,
    });
  }
  revalidatePath(`/browse/s/${slug}`);
  return { success: true, data: result };
}

/** Save / unsave a post to the viewer's Saved list. Needs a BizNest account. */
export async function toggleBrowseSave(postId: string): Promise<ActionResult<{ saved: boolean; saveCount: number }>> {
  const viewer = await getViewer();
  if (!viewer?.userId) return { success: false, error: "Sign in or join BizNest to save posts." };
  const rl = await checkRateLimit(`browse-save:${await ip()}`, 150, 3_600_000);
  if (!rl.allowed) return { success: false, error: "You're saving very fast. Try again in a bit." };
  const post = await livePost(postId);
  if (!post) return { success: false, error: "This post is no longer available." };

  const result = await prisma.$transaction(async (tx) => {
    const removed = await tx.browseSave.deleteMany({ where: { postId, viewerKey: viewer.key } });
    if (removed.count > 0) {
      const p = await tx.browsePost.update({ where: { id: postId }, data: { saveCount: { decrement: 1 } }, select: { saveCount: true } });
      return { saved: false, saveCount: Math.max(0, p.saveCount) };
    }
    try {
      await tx.browseSave.create({ data: { postId, viewerKey: viewer.key } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const p = await tx.browsePost.findUnique({ where: { id: postId }, select: { saveCount: true } });
        return { saved: true, saveCount: p?.saveCount ?? 0 };
      }
      throw e;
    }
    const p = await tx.browsePost.update({ where: { id: postId }, data: { saveCount: { increment: 1 } }, select: { saveCount: true } });
    return { saved: true, saveCount: p.saveCount };
  });
  if (result.saved) void recordPostInterest(viewer.key, { storeId: post.store.id, category: post.store.business?.category, caption: post.caption }, INTEREST_WEIGHT.SAVE);
  if (result.saved && post.store.business?.user?.id !== viewer.userId) await bumpBrowseStat(post.store.id, "SAVE", postId, 1).catch(() => undefined);
  return { success: true, data: result };
}

/** The store that owns a post can pin one comment to the top (one at a time) or unpin it. */
export async function pinBrowseComment(commentId: string, pinned: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer?.userId) return { success: false, error: "Not allowed." };
  const c = await prisma.browseComment.findFirst({
    where: { id: commentId, status: "VISIBLE" },
    select: { id: true, postId: true, post: { select: { store: { select: { business: { select: { userId: true } } } } } } },
  });
  if (!c || c.post.store.business?.userId !== viewer.userId) return { success: false, error: "Only the store that posted this can pin comments." };
  await prisma.$transaction([
    prisma.browseComment.updateMany({ where: { postId: c.postId, pinned: true }, data: { pinned: false } }),
    ...(pinned ? [prisma.browseComment.update({ where: { id: c.id }, data: { pinned: true } })] : []),
  ]);
  return { success: true, data: undefined };
}

export async function addBrowseComment(postId: string, input: { body: string }): Promise<ActionResult<{ comment: BrowseCommentView; commentCount: number }>> {
  const viewer = await getViewer();
  if (!viewer?.userId) return { success: false, error: INTERACT_NEEDS_ACCOUNT };
  const rl = await checkRateLimit(`browse-comment:${await ip()}:${viewer.key}`, 6, 10 * 60_000);
  if (!rl.allowed) return { success: false, error: "You're commenting too fast. Wait a few minutes." };
  const post = await livePost(postId);
  if (!post) return { success: false, error: "This post is no longer available." };

  // Signed-in people never type a name: a vendor comments as their store, anyone else as their account name.
  let displayName = viewer.name?.trim() || "";
  const byStore = post.store.business?.user?.id === viewer.userId;
  if (byStore) displayName = post.store.name;
  else {
    const own = await prisma.store.findFirst({ where: { business: { userId: viewer.userId } }, orderBy: { createdAt: "asc" }, select: { name: true } });
    if (own?.name) displayName = own.name;
  }
  if (displayName.trim().length < 2) {
    const u = await prisma.user.findUnique({ where: { id: viewer.userId }, select: { email: true } });
    displayName = u?.email.split("@")[0] || "BizNest member";
  }
  const parsed = sanitizeComment({ body: input.body }, { signedInName: displayName });
  if (!parsed.ok) return { success: false, error: parsed.error };

  const dup = await prisma.browseComment.findFirst({ where: { postId, viewerKey: viewer.key, body: parsed.body, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } }, select: { id: true } });
  if (dup) return { success: false, error: "You already posted that." };

  const [comment, updated] = await prisma.$transaction([
    prisma.browseComment.create({ data: { postId, viewerKey: viewer.key, authorName: parsed.name, body: parsed.body, byStore } }),
    prisma.browsePost.update({ where: { id: postId }, data: { commentCount: { increment: 1 } }, select: { commentCount: true } }),
  ]);

  if (!byStore) void recordPostInterest(viewer.key, { storeId: post.store.id, category: post.store.business?.category, caption: post.caption }, INTEREST_WEIGHT.COMMENT);
  const ownerId = post.store.business?.user?.id;
  if (ownerId && ownerId !== viewer.userId) {
    await notifyUser({
      userId: ownerId, type: "BROWSE_COMMENT", title: `${parsed.name} commented on your Browse post`,
      body: parsed.body.slice(0, 120), url: `/store/${post.store.slug}/admin/browse/activity`,
    }).catch(() => undefined);
  }
  return {
    success: true,
    data: { comment: { id: comment.id, authorName: comment.authorName, body: comment.body, createdAt: comment.createdAt.toISOString(), mine: true, byStore }, commentCount: updated.commentCount },
  };
}

export async function deleteMyBrowseComment(commentId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { success: false, error: "Not allowed." };
  const c = await prisma.browseComment.findFirst({ where: { id: commentId, viewerKey: viewer.key }, select: { id: true, postId: true, status: true } });
  if (!c) return { success: false, error: "Comment not found." };
  await prisma.$transaction([
    prisma.browseComment.delete({ where: { id: c.id } }),
    ...(c.status === "VISIBLE" ? [prisma.browsePost.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } })] : []),
  ]);
  return { success: true, data: undefined };
}

/** Report a post, one of its comments, or a story. Enough distinct reports hide it until BizNest staff decide. */
export async function reportBrowse(input: { postId?: string; commentId?: string; storyId?: string; reason: string }): Promise<ActionResult> {
  const viewer = await getViewer({ create: true });
  if (!viewer) return { success: false, error: "Could not identify your browser." };
  if (!REPORT_REASONS.includes(input.reason as ReportReason)) return { success: false, error: "Choose a reason." };
  const rl = await checkRateLimit(`browse-report:${await ip()}`, 20, 3_600_000);
  if (!rl.allowed) return { success: false, error: "Too many reports. Try again later." };

  // ---- story
  if (input.storyId) {
    const story = await prisma.browseStory.findFirst({ where: { id: input.storyId, status: "ACTIVE" }, select: { id: true } });
    if (!story) return { success: false, error: "This story is no longer available." };
    const targetKey = `story:${story.id}`;
    try {
      await prisma.browseReport.create({ data: { storyId: story.id, targetKey, viewerKey: viewer.key, reason: input.reason } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { success: true, data: undefined };
      throw e;
    }
    const open = await prisma.browseReport.count({ where: { targetKey, status: "OPEN" } });
    if (open >= BROWSE_REPORT_HIDE_AT) await prisma.browseStory.updateMany({ where: { id: story.id, status: "ACTIVE" }, data: { status: "HIDDEN" } });
    return { success: true, data: undefined };
  }

  // ---- post / comment
  if (!input.postId) return { success: false, error: "Nothing to report." };
  const post = await prisma.browsePost.findFirst({ where: { id: input.postId, status: { not: "REMOVED" } }, select: { id: true, status: true } });
  if (!post) return { success: false, error: "This post is no longer available." };
  let commentVisible = false;
  if (input.commentId) {
    const c = await prisma.browseComment.findFirst({ where: { id: input.commentId, postId: post.id }, select: { id: true, status: true } });
    if (!c) return { success: false, error: "Comment not found." };
    commentVisible = c.status === "VISIBLE";
  }
  const targetKey = input.commentId ? `comment:${input.commentId}` : `post:${post.id}`;

  try {
    await prisma.browseReport.create({ data: { postId: post.id, commentId: input.commentId ?? null, targetKey, viewerKey: viewer.key, reason: input.reason } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { success: true, data: undefined }; // already reported
    throw e;
  }

  const open = await prisma.browseReport.count({ where: { targetKey, status: "OPEN" } });
  if (open >= BROWSE_REPORT_HIDE_AT) {
    if (input.commentId && commentVisible) {
      await prisma.$transaction([
        prisma.browseComment.update({ where: { id: input.commentId }, data: { status: "HIDDEN" } }),
        prisma.browsePost.update({ where: { id: post.id }, data: { commentCount: { decrement: 1 } } }),
      ]);
    } else if (!input.commentId && post.status === "PUBLISHED") {
      await prisma.browsePost.update({ where: { id: post.id }, data: { status: "HIDDEN", hiddenReason: "REPORTS" } });
      revalidatePath("/browse");
    }
  }
  return { success: true, data: undefined };
}

/** Count a story view once per viewer (the owner looking at their own story doesn't count). */
export async function markStoryViewed(storyId: string): Promise<ActionResult> {
  const viewer = await getViewer({ create: true });
  if (!viewer) return { success: true, data: undefined };
  const rl = await checkRateLimit(`browse-story-view:${await ip()}`, 600, 3_600_000);
  if (!rl.allowed) return { success: true, data: undefined };
  const story = await prisma.browseStory.findFirst({
    where: { id: storyId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    select: { id: true, store: { select: { business: { select: { user: { select: { id: true } } } } } } },
  });
  if (!story) return { success: true, data: undefined };
  const isOwner = !!viewer.userId && story.store.business?.user?.id === viewer.userId;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.browseStoryView.create({ data: { storyId, viewerKey: viewer.key } });
      if (!isOwner) await tx.browseStory.update({ where: { id: storyId }, data: { viewCount: { increment: 1 } } });
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; // already viewed
  }
  return { success: true, data: undefined };
}

export async function loadMoreStorePosts(slug: string, cursor: string | null): Promise<ActionResult<{ posts: GridPost[]; nextCursor: string | null }>> {
  const profile = await loadStoreProfile(slug.slice(0, 80));
  if (!profile) return { success: false, error: "Store not found." };
  return { success: true, data: await loadStorePosts(profile.id, cursor) };
}

export async function loadMoreBrowse(input: { sort?: FeedSort; category?: string | null; cursor?: string | null; following?: boolean; saved?: boolean; videoOnly?: boolean }): Promise<ActionResult<FeedPage>> {
  const sort: FeedSort = input.sort === "popular" ? "popular" : input.sort === "latest" ? "latest" : "foryou";
  const viewer = await getViewer();
  if (input.saved) {
    if (!viewer?.userId) return { success: false, error: "Sign in to see your saved posts." };
    return { success: true, data: await loadSavedPosts(viewer.key, input.cursor ?? null) };
  }
  let storeIds: string[] | undefined;
  if (input.following) {
    if (!viewer?.userId) return { success: false, error: FOLLOW_NEEDS_ACCOUNT };
    storeIds = await loadFollowedStoreIds(viewer.key);
  }
  const page = await loadBrowseFeed({ sort, category: input.category?.slice(0, 80) || null, cursor: input.cursor ?? null, viewerKey: viewer?.key, storeIds, videoOnly: !!input.videoOnly });
  return { success: true, data: page };
}

export async function loadPostComments(postId: string, before?: string | null): Promise<ActionResult<{ comments: BrowseCommentView[]; nextCursor: string | null; isOwner: boolean }>> {
  const post = await prisma.browsePost.findFirst({ where: { id: postId, status: "PUBLISHED", store: { status: "ACTIVE" } }, select: { id: true, store: { select: { business: { select: { userId: true } } } } } });
  if (!post) return { success: false, error: "This post is no longer available." };
  const viewer = await getViewer();
  const page = await loadBrowseComments(postId, { before, viewerKey: viewer?.key });
  return { success: true, data: { ...page, isOwner: !!viewer?.userId && post.store.business?.userId === viewer.userId } };
}

/** Reviews of the product or service a post shows, for the post window. */
export async function loadPostReviewSummary(postId: string): Promise<ActionResult<PostReviews | null>> {
  const post = await prisma.browsePost.findFirst({ where: { id: postId, status: "PUBLISHED", store: { status: "ACTIVE" } }, select: { storeId: true, productId: true, tagKind: true } });
  if (!post?.productId) return { success: true, data: null };
  return { success: true, data: await loadPostReviews(post.storeId, post.tagKind === "SERVICE" ? "SERVICE" : "PRODUCT", post.productId).catch(() => null) };
}
