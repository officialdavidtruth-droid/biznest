"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { BROWSE_DAILY_POST_LIMIT, BROWSE_MAX_IMAGES, STORY_DAILY_LIMIT, defaultProductCaption, sanitizePost, sanitizeStory, storyExpiry } from "@/lib/browse";
import { loadBrowseComments, type BrowseCommentView } from "@/lib/browse-data";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  const a = await assertStorePermission(slug, "marketing");
  if (!a.success) return a;
  if (a.store.status !== "ACTIVE") return { success: false as const, error: "Your store must be active to post on Browse." };
  return a;
}

async function underDailyLimit(storeId: string) {
  const n = await prisma.browsePost.count({ where: { storeId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  return n < BROWSE_DAILY_POST_LIMIT;
}

const refresh = (slug: string) => { revalidatePath(`/store/${slug}/admin/browse`); revalidatePath("/browse"); };

/** A free-form update: text and/or up to four photos, optionally tagging one of the store's products. */
export async function createBrowsePost(slug: string, input: { caption?: string; images?: string[]; productId?: string | null }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const parsed = sanitizePost(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  if (!(await underDailyLimit(a.store.id))) return { success: false, error: `You can post up to ${BROWSE_DAILY_POST_LIMIT} times a day.` };

  let product: { id: string; name: string; price: unknown; currency: string } | null = null;
  if (input.productId) {
    product = await prisma.product.findFirst({ where: { id: input.productId, storeId: a.store.id, isPublished: true, archivedAt: null }, select: { id: true, name: true, price: true, currency: true } });
    if (!product) return { success: false, error: "That product isn't available to tag." };
  }
  const post = await prisma.browsePost.create({
    data: {
      storeId: a.store.id, kind: product ? "PRODUCT" : "UPDATE", caption: parsed.caption, images: parsed.images,
      ...(product ? { productId: product.id, productName: product.name, productPrice: product.price as number, productCurrency: product.currency } : {}),
    },
    select: { id: true },
  });
  refresh(slug);
  return { success: true, data: { id: post.id } };
}

/** One tap from the products list: posts the product's photos, name and price. */
export async function shareProductToBrowse(slug: string, productId: string, caption?: string): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: a.store.id },
    select: { id: true, name: true, price: true, currency: true, images: true, isPublished: true, archivedAt: true },
  });
  if (!product) return { success: false, error: "Product not found." };
  if (!product.isPublished || product.archivedAt) return { success: false, error: "Only active products can be shared." };
  const images = product.images.slice(0, BROWSE_MAX_IMAGES);
  if (images.length === 0) return { success: false, error: "Add a photo to this product before sharing it." };

  const recent = await prisma.browsePost.findFirst({
    where: { storeId: a.store.id, productId, status: { not: "REMOVED" }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    select: { id: true },
  });
  if (recent) return { success: false, error: "You already shared this product in the last 24 hours." };
  if (!(await underDailyLimit(a.store.id))) return { success: false, error: `You can post up to ${BROWSE_DAILY_POST_LIMIT} times a day.` };

  const parsed = sanitizePost({ caption: caption?.trim() || defaultProductCaption(product.name), images }, { requireImage: true });
  if (!parsed.ok) return { success: false, error: parsed.error };
  const post = await prisma.browsePost.create({
    data: { storeId: a.store.id, kind: "PRODUCT", caption: parsed.caption, images: parsed.images, productId: product.id, productName: product.name, productPrice: product.price as number, productCurrency: product.currency },
    select: { id: true },
  });
  refresh(slug);
  return { success: true, data: { id: post.id } };
}

/** Hide a post from the feed, or put it back. Posts held for review (reports/admin) can't be re-published by the owner. */
export async function setBrowsePostHidden(slug: string, postId: string, hidden: boolean): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const post = await prisma.browsePost.findFirst({ where: { id: postId, storeId: a.store.id }, select: { id: true, status: true, hiddenReason: true } });
  if (!post || post.status === "REMOVED") return { success: false, error: "Post not found." };
  if (!hidden && post.hiddenReason && post.hiddenReason !== "OWNER") return { success: false, error: "This post is under review by BizNest and can't be re-published yet." };
  await prisma.browsePost.update({ where: { id: post.id }, data: hidden ? { status: "HIDDEN", hiddenReason: "OWNER" } : { status: "PUBLISHED", hiddenReason: null } });
  refresh(slug);
  return { success: true, data: undefined };
}

export async function deleteBrowsePost(slug: string, postId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.browsePost.deleteMany({ where: { id: postId, storeId: a.store.id } });
  if (res.count === 0) return { success: false, error: "Post not found." };
  refresh(slug);
  return { success: true, data: undefined };
}

export async function listPostCommentsForOwner(slug: string, postId: string): Promise<ActionResult<{ comments: BrowseCommentView[] }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const post = await prisma.browsePost.findFirst({ where: { id: postId, storeId: a.store.id }, select: { id: true } });
  if (!post) return { success: false, error: "Post not found." };
  const { comments } = await loadBrowseComments(post.id, { includeHidden: true, take: 50 });
  return { success: true, data: { comments } };
}

export async function setBrowseCommentHidden(slug: string, commentId: string, hidden: boolean): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const c = await prisma.browseComment.findFirst({ where: { id: commentId, post: { storeId: a.store.id } }, select: { id: true, postId: true, status: true } });
  if (!c) return { success: false, error: "Comment not found." };
  const to = hidden ? "HIDDEN" : "VISIBLE";
  if (c.status === to) return { success: true, data: undefined };
  await prisma.$transaction([
    prisma.browseComment.update({ where: { id: c.id }, data: { status: to } }),
    prisma.browsePost.update({ where: { id: c.postId }, data: { commentCount: { increment: hidden ? -1 : 1 } } }),
  ]);
  refresh(slug);
  return { success: true, data: undefined };
}

/** A 24-hour story: one photo or a text card, optionally pointing at a product. */
export async function createBrowseStory(slug: string, input: { imageUrl?: string | null; text?: string; bgColor?: string; productId?: string | null }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const parsed = sanitizeStory(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const today = await prisma.browseStory.count({ where: { storeId: a.store.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (today >= STORY_DAILY_LIMIT) return { success: false, error: `You can add up to ${STORY_DAILY_LIMIT} stories a day.` };

  let product: { id: string; name: string; price: unknown; currency: string } | null = null;
  if (input.productId) {
    product = await prisma.product.findFirst({ where: { id: input.productId, storeId: a.store.id, isPublished: true, archivedAt: null }, select: { id: true, name: true, price: true, currency: true } });
    if (!product) return { success: false, error: "That product isn't available to tag." };
  }
  const story = await prisma.browseStory.create({
    data: {
      storeId: a.store.id, kind: parsed.kind, imageUrl: parsed.imageUrl, text: parsed.text, bgColor: parsed.bgColor, expiresAt: storyExpiry(),
      ...(product ? { productId: product.id, productName: product.name, productPrice: product.price as number, productCurrency: product.currency } : {}),
    },
    select: { id: true },
  });
  // Tidy this store's old expired stories while we're here (cheap, bounded).
  await prisma.browseStory.deleteMany({ where: { storeId: a.store.id, expiresAt: { lt: new Date(Date.now() - 3 * 86_400_000) } } }).catch(() => undefined);
  refresh(slug);
  return { success: true, data: { id: story.id } };
}

export async function deleteBrowseStory(slug: string, storyId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.browseStory.deleteMany({ where: { id: storyId, storeId: a.store.id } });
  if (res.count === 0) return { success: false, error: "Story not found." };
  refresh(slug);
  return { success: true, data: undefined };
}
