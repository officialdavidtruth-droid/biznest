"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { recomputeBusinessRating } from "@/lib/reviews/rating";
import { notifyCustomerOfReviewReply } from "@/lib/reviews/notify-reply";

const MAX_COMMENT_LENGTH = 2000;
const MAX_RESPONSE_LENGTH = 2000;
const MAX_IMAGES = 5;

function revalidateReviewPaths(storeSlug: string) {
  revalidatePath(`/store/${storeSlug}`); // home: rating badges + AggregateRating markup
  revalidatePath(`/store/${storeSlug}/reviews`);
  revalidatePath(`/store/${storeSlug}/account/reviews`);
  revalidatePath(`/store/${storeSlug}/admin/reviews`);
}

// Only accept photos that came from our own upload route (Cloudinary, under
// the reviews folder) so a client can't attach arbitrary external URLs.
function isOwnUploadUrl(u: unknown): u is string {
  if (typeof u !== "string") return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && url.pathname.includes("/biznest/reviews/");
  } catch {
    return false;
  }
}

function validateRating(rating: unknown): rating is number {
  return typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

/**
 * "Verified customer" check: the reviewer must have a delivered/completed
 * order containing the item, or a completed booking for the service. A
 * store-level review (no product/service) needs any completed order or
 * booking at that store.
 */
async function hasVerifiedPurchase(args: {
  userId: string;
  storeId: string;
  productId?: string | null;
  serviceId?: string | null;
}): Promise<boolean> {
  const { userId, storeId, productId, serviceId } = args;
  const doneOrder = { in: ["DELIVERED", "COMPLETED"] as ("DELIVERED" | "COMPLETED")[] };

  if (productId) {
    const order = await prisma.order.findFirst({
      where: { buyerId: userId, storeId, status: doneOrder, items: { some: { productId } } },
      select: { id: true },
    });
    return !!order;
  }

  if (serviceId) {
    const [booking, order] = await Promise.all([
      prisma.booking.findFirst({ where: { buyerId: userId, storeId, serviceId, status: "COMPLETED" }, select: { id: true } }),
      prisma.order.findFirst({
        where: { buyerId: userId, storeId, status: doneOrder, items: { some: { serviceId } } },
        select: { id: true },
      }),
    ]);
    return !!(booking || order);
  }

  const [booking, order] = await Promise.all([
    prisma.booking.findFirst({ where: { buyerId: userId, storeId, status: "COMPLETED" }, select: { id: true } }),
    prisma.order.findFirst({ where: { buyerId: userId, storeId, status: doneOrder }, select: { id: true } }),
  ]);
  return !!(booking || order);
}

export type CreateReviewInput = {
  productId?: string | null;
  serviceId?: string | null;
  rating: number;
  comment?: string;
  images?: string[];
};

export async function createReview(storeSlug: string, input: CreateReviewInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireStoreCustomer(storeSlug);
  if (!ctx) return { success: false, error: "Please sign in to leave a review." };

  if (!validateRating(input.rating)) return { success: false, error: "Please choose a rating from 1 to 5 stars." };

  const productId = input.productId || null;
  const serviceId = input.serviceId || null;
  if (productId && serviceId) return { success: false, error: "A review can only be about one item." };

  const comment = input.comment?.trim() || null;
  if (comment && comment.length > MAX_COMMENT_LENGTH) {
    return { success: false, error: `Reviews can be at most ${MAX_COMMENT_LENGTH} characters.` };
  }
  const images = (input.images ?? []).filter(isOwnUploadUrl).slice(0, MAX_IMAGES);

  const limit = await checkRateLimit(`review:${ctx.userId}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) return { success: false, error: "You're submitting reviews too quickly. Please try again later." };

  // The item must belong to THIS store (a customer session is store-scoped).
  if (productId) {
    const p = await prisma.product.findFirst({ where: { id: productId, storeId: ctx.storeId }, select: { id: true } });
    if (!p) return { success: false, error: "That item doesn't belong to this store." };
  }
  if (serviceId) {
    const s = await prisma.service.findFirst({ where: { id: serviceId, storeId: ctx.storeId }, select: { id: true } });
    if (!s) return { success: false, error: "That item doesn't belong to this store." };
  }

  const verified = await hasVerifiedPurchase({ userId: ctx.userId, storeId: ctx.storeId, productId, serviceId });
  if (!verified) {
    return { success: false, error: "You can review this once your order or booking has been completed." };
  }

  // One review per customer per item (the schema has no unique constraint).
  const existing = await prisma.review.findFirst({
    where: { authorId: ctx.userId, storeId: ctx.storeId, productId, serviceId },
    select: { id: true },
  });
  if (existing) return { success: false, error: "You've already reviewed this. You can edit your review instead." };

  const review = await prisma.review.create({
    data: { storeId: ctx.storeId, authorId: ctx.userId, productId, serviceId, rating: input.rating, comment, images },
    select: { id: true },
  });

  await recomputeBusinessRating(ctx.storeId);

  // Best-effort owner notification; never fail the review because of it.
  try {
    const store = await prisma.store.findUnique({ where: { id: ctx.storeId }, select: { business: { select: { userId: true } } } });
    if (store?.business.userId) {
      await notifyUser({
        userId: store.business.userId,
        type: "REVIEW",
        title: `New ${input.rating}-star review`,
        body: comment ? comment.slice(0, 140) : "A customer left a rating.",
        url: `/store/${storeSlug}/admin/reviews`,
      });
    }
  } catch (err) {
    console.error("[reviews] owner notification failed", err);
  }

  revalidateReviewPaths(storeSlug);
  return { success: true, data: { id: review.id } };
}

export async function updateReview(
  storeSlug: string,
  reviewId: string,
  input: { rating: number; comment?: string }
): Promise<ActionResult> {
  const ctx = await requireStoreCustomer(storeSlug);
  if (!ctx) return { success: false, error: "Please sign in." };
  if (!validateRating(input.rating)) return { success: false, error: "Please choose a rating from 1 to 5 stars." };

  const comment = input.comment?.trim() || null;
  if (comment && comment.length > MAX_COMMENT_LENGTH) {
    return { success: false, error: `Reviews can be at most ${MAX_COMMENT_LENGTH} characters.` };
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, authorId: ctx.userId, storeId: ctx.storeId },
    select: { id: true },
  });
  if (!review) return { success: false, error: "Review not found." };

  await prisma.review.update({ where: { id: review.id }, data: { rating: input.rating, comment } });
  await recomputeBusinessRating(ctx.storeId);

  revalidateReviewPaths(storeSlug);
  return { success: true, data: undefined };
}

export async function deleteReview(storeSlug: string, reviewId: string): Promise<ActionResult> {
  const ctx = await requireStoreCustomer(storeSlug);
  if (!ctx) return { success: false, error: "Please sign in." };

  const review = await prisma.review.findFirst({
    where: { id: reviewId, authorId: ctx.userId, storeId: ctx.storeId },
    select: { id: true },
  });
  if (!review) return { success: false, error: "Review not found." };

  await prisma.review.delete({ where: { id: review.id } });
  await recomputeBusinessRating(ctx.storeId);

  revalidateReviewPaths(storeSlug);
  return { success: true, data: undefined };
}

/** Merchant reply to a review. One response per review; calling again edits it. */
export async function respondToReview(storeSlug: string, reviewId: string, content: string): Promise<ActionResult> {
  const access = await assertStorePermission(storeSlug, "reviews");
  if (!access.success) return { success: false, error: access.error };

  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const text = content.trim();
  if (!text) return { success: false, error: "Please write a response." };
  if (text.length > MAX_RESPONSE_LENGTH) return { success: false, error: `Responses can be at most ${MAX_RESPONSE_LENGTH} characters.` };

  const review = await prisma.review.findFirst({
    where: { id: reviewId, storeId: access.store.id },
    select: {
      id: true,
      response: { select: { id: true } },
      author: { select: { id: true, email: true, name: true } },
    },
  });
  if (!review) return { success: false, error: "Review not found." };

  const isFirstReply = !review.response;

  await prisma.reviewResponse.upsert({
    where: { reviewId: review.id },
    create: { reviewId: review.id, authorId: session.user.id, content: text },
    update: { content: text, authorId: session.user.id },
  });

  // Only the first reply notifies the customer; later edits (typo fixes) stay quiet.
  if (isFirstReply) {
    await notifyCustomerOfReviewReply({ store: access.store, customer: review.author, reply: text });
  }

  revalidateReviewPaths(storeSlug);
  return { success: true, data: undefined };
}

/** Remove the merchant's public reply (the review itself is untouched). */
export async function deleteReviewResponse(storeSlug: string, reviewId: string): Promise<ActionResult> {
  const access = await assertStorePermission(storeSlug, "reviews");
  if (!access.success) return { success: false, error: access.error };

  const response = await prisma.reviewResponse.findFirst({
    where: { reviewId, review: { storeId: access.store.id } },
    select: { id: true },
  });
  if (!response) return { success: false, error: "Response not found." };

  await prisma.reviewResponse.delete({ where: { id: response.id } });
  revalidateReviewPaths(storeSlug);
  return { success: true, data: undefined };
}

/** Which items the signed-in customer can still review (completed, not yet reviewed). */
export async function listReviewableItems(storeSlug: string) {
  const ctx = await requireStoreCustomer(storeSlug);
  if (!ctx) return [];

  const [orderItems, bookings, reviewed] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { buyerId: ctx.userId, storeId: ctx.storeId, status: { in: ["DELIVERED", "COMPLETED"] } } },
      select: { productId: true, serviceId: true, product: { select: { name: true } }, service: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { buyerId: ctx.userId, storeId: ctx.storeId, status: "COMPLETED" },
      select: { serviceId: true, service: { select: { name: true } } },
    }),
    prisma.review.findMany({ where: { authorId: ctx.userId, storeId: ctx.storeId }, select: { productId: true, serviceId: true } }),
  ]);

  const done = new Set(reviewed.map((r) => `${r.productId ?? ""}|${r.serviceId ?? ""}`));
  const items = new Map<string, { productId: string | null; serviceId: string | null; name: string }>();

  for (const oi of orderItems) {
    const key = `${oi.productId ?? ""}|${oi.serviceId ?? ""}`;
    const name = oi.product?.name ?? oi.service?.name;
    if (key !== "|" && name && !done.has(key)) items.set(key, { productId: oi.productId, serviceId: oi.serviceId, name });
  }
  for (const b of bookings) {
    const key = `|${b.serviceId}`;
    if (!done.has(key)) items.set(key, { productId: null, serviceId: b.serviceId, name: b.service.name });
  }
  return Array.from(items.values());
}
