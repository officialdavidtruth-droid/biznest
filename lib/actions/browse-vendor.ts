"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { isPlatformStaff } from "@/lib/admin-guard";
import { notifyFollowersOfPost, notifyFollowersOfStory } from "@/lib/browse-notify";
import { sanitizeStickers, BROWSE_DAILY_POST_LIMIT, OFFICIAL_SLUG, BROWSE_MAX_IMAGES, STORY_DAILY_LIMIT, defaultProductCaption, sanitizePost, sanitizeStory, storyExpiry } from "@/lib/browse";
import { loadBrowseComments, type BrowseCommentView } from "@/lib/browse-data";
import { isBrowseVideoUrl, videoFolder, videoPosterUrl } from "@/lib/browse-video";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  // BizNest's own account has no owner who signs in: SupaAdmin staff manage it with the same tools vendors use.
  if (slug === OFFICIAL_SLUG) {
    if (!(await isPlatformStaff())) return { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!store) return { success: false as const, error: "Set up the BizNest official account first." };
    return { success: true as const, store };
  }
  const a = await assertStorePermission(slug, "marketing");
  if (!a.success) return a;
  if (a.store.status !== "ACTIVE") return { success: false as const, error: "Your store must be active to post on Browse." };
  return a;
}

async function underDailyLimit(storeId: string) {
  const n = await prisma.browsePost.count({ where: { storeId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  return n < BROWSE_DAILY_POST_LIMIT;
}

/** Alerts the business's signed-in followers. Looks up the display name here so callers stay simple; never throws. */
async function tellFollowersOfPost(slug: string, storeId: string, postId: string, caption: string, productName?: string | null) {
  try {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });
    if (store) notifyFollowersOfPost({ storeId, storeName: store.name, storeSlug: slug, postId, caption, productName });
  } catch { /* a notification problem must never fail the post */ }
}
async function tellFollowersOfStory(slug: string, storeId: string) {
  try {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });
    if (store) notifyFollowersOfStory({ storeId, storeName: store.name, storeSlug: slug });
  } catch { /* a notification problem must never fail the story */ }
}

const refresh = (slug: string) => { revalidatePath(`/store/${slug}/admin/browse`); revalidatePath("/supaadmin/official"); revalidatePath("/browse"); };

/** A free-form update: text and/or up to four photos, optionally tagging one of the store's products. */
export async function createBrowsePost(slug: string, input: { caption?: string; images?: string[]; videoUrl?: string | null; coverTime?: number; stickers?: unknown; tagKind?: "PRODUCT" | "SERVICE"; productId?: string | null }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const parsed = sanitizePost(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  // A video must be one we signed for this store (that signature is what applies the 60-second trim). Its poster frame becomes the cover image.
  let videoUrl: string | null = null;
  let images = parsed.images;
  if (parsed.videoUrl) {
    if (process.env.BROWSE_VIDEO === "off") return { success: false, error: "Video posting is switched off right now." };
    if (!isBrowseVideoUrl(parsed.videoUrl, videoFolder(a.store.id, slug === OFFICIAL_SLUG))) return { success: false, error: "That video wasn't uploaded here. Upload it again." };
    videoUrl = parsed.videoUrl;
    images = parsed.images.length > 0 ? parsed.images.slice(0, 1) : [videoPosterUrl(videoUrl, typeof input.coverTime === "number" ? input.coverTime : 0)];
  }
  if (!(await underDailyLimit(a.store.id))) return { success: false, error: `You can post up to ${BROWSE_DAILY_POST_LIMIT} times a day.` };

  let product: { id: string; name: string; price: unknown; currency: string } | null = null;
  const tagKind = input.tagKind === "SERVICE" ? "SERVICE" : "PRODUCT";
  if (input.productId) {
    product = tagKind === "SERVICE"
      ? await prisma.service.findFirst({ where: { id: input.productId, storeId: a.store.id, isPublished: true }, select: { id: true, name: true, price: true, currency: true } })
      : await prisma.product.findFirst({ where: { id: input.productId, storeId: a.store.id, isPublished: true, archivedAt: null }, select: { id: true, name: true, price: true, currency: true } });
    if (!product) return { success: false, error: `That ${tagKind === "SERVICE" ? "service" : "product"} isn't available to tag.` };
  }
  const stickers = sanitizeStickers(input.stickers);
  const post = await prisma.browsePost.create({
    data: {
      storeId: a.store.id, kind: product ? "PRODUCT" : "UPDATE", caption: parsed.caption, images, videoUrl, tagKind, ...(stickers.length ? { stickers } : {}),
      ...(product ? { productId: product.id, productName: product.name, productPrice: product.price as number, productCurrency: product.currency } : {}),
    },
    select: { id: true },
  });
  refresh(slug);
  await tellFollowersOfPost(slug, a.store.id, post.id, parsed.caption, product?.name);
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
    data: { storeId: a.store.id, kind: "PRODUCT", caption: parsed.caption, images: parsed.images, productId: product.id, productName: product.name, productPrice: product.price, productCurrency: product.currency },
    select: { id: true },
  });
  refresh(slug);
  await tellFollowersOfPost(slug, a.store.id, post.id, parsed.caption, product.name);
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
  await tellFollowersOfStory(slug, a.store.id);
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
