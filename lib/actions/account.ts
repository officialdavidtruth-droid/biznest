"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

// ============ ADDRESSES ============

export async function listAddresses() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function addAddress(input: {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country?: string;
  isDefault?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You need to sign in first." };

  if (!input.fullName || !input.phone || !input.line1 || !input.city || !input.state) {
    return { success: false, error: "Please fill in all required fields." };
  }

  if (input.isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: { ...input, userId: session.user.id },
  });

  revalidatePath("/account/addresses");
  return { success: true, data: { id: address.id } };
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You need to sign in first." };

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== session.user.id) {
    return { success: false, error: "Address not found." };
  }

  await prisma.address.delete({ where: { id: addressId } });
  revalidatePath("/account/addresses");
  return { success: true, data: undefined };
}

export async function setDefaultAddress(addressId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You need to sign in first." };

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== session.user.id) {
    return { success: false, error: "Address not found." };
  }

  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);

  revalidatePath("/account/addresses");
  return { success: true, data: undefined };
}

// ============ WISHLIST ============

export async function listWishlist() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    include: {
      product: { include: { store: { select: { slug: true, name: true } } } },
      service: { include: { store: { select: { slug: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function toggleWishlist(input: {
  productId?: string;
  serviceId?: string;
}): Promise<ActionResult<{ wishlisted: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You need to sign in first." };
  if (!input.productId && !input.serviceId) {
    return { success: false, error: "No item specified." };
  }

  const existing = await prisma.wishlistItem.findFirst({
    where: {
      userId: session.user.id,
      productId: input.productId ?? null,
      serviceId: input.serviceId ?? null,
    },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/account/wishlist");
    return { success: true, data: { wishlisted: false } };
  }

  await prisma.wishlistItem.create({
    data: {
      userId: session.user.id,
      productId: input.productId ?? null,
      serviceId: input.serviceId ?? null,
    },
  });

  revalidatePath("/account/wishlist");
  return { success: true, data: { wishlisted: true } };
}

// ============ RECENTLY VIEWED ============

// Called from product/service detail pages on view. Fire-and-forget from
// the caller's perspective -- failures here shouldn't block page render.
export async function recordRecentlyViewed(input: {
  productId?: string;
  serviceId?: string;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  if (!input.productId && !input.serviceId) return;

  await prisma.recentlyViewed.create({
    data: {
      userId: session.user.id,
      productId: input.productId ?? null,
      serviceId: input.serviceId ?? null,
    },
  });

  // Keep only the most recent 50 per user so this table doesn't grow unbounded.
  const excess = await prisma.recentlyViewed.findMany({
    where: { userId: session.user.id },
    orderBy: { viewedAt: "desc" },
    skip: 50,
    select: { id: true },
  });
  if (excess.length > 0) {
    await prisma.recentlyViewed.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
  }
}

export async function listRecentlyViewed(limit = 20) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.recentlyViewed.findMany({
    where: { userId: session.user.id },
    include: {
      product: { include: { store: { select: { slug: true, name: true } } } },
      service: { include: { store: { select: { slug: true, name: true } } } },
    },
    orderBy: { viewedAt: "desc" },
    take: limit,
  });
}

// ============ FAVORITE BUSINESSES ============

export async function listFavoriteBusinesses() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.favoriteBusiness.findMany({
    where: { userId: session.user.id },
    include: { business: { include: { store: { select: { slug: true, logoUrl: true, bannerUrl: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function toggleFavoriteBusiness(
  businessId: string
): Promise<ActionResult<{ favorited: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You need to sign in first." };

  const existing = await prisma.favoriteBusiness.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId } },
  });

  if (existing) {
    await prisma.favoriteBusiness.delete({ where: { id: existing.id } });
    revalidatePath("/account/favorites");
    return { success: true, data: { favorited: false } };
  }

  await prisma.favoriteBusiness.create({ data: { userId: session.user.id, businessId } });
  revalidatePath("/account/favorites");
  return { success: true, data: { favorited: true } };
}

// ============ SAVED CARTS ============

export async function saveCart(
  storeId: string,
  items: { productId: string; quantity: number }[]
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You need to sign in first." };

  await prisma.savedCart.upsert({
    where: { userId_storeId: { userId: session.user.id, storeId } },
    create: { userId: session.user.id, storeId, items },
    update: { items },
  });

  return { success: true, data: undefined };
}

export async function listSavedCarts() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.savedCart.findMany({
    where: { userId: session.user.id },
    include: { store: { select: { slug: true, name: true, logoUrl: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function deleteSavedCart(cartId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You need to sign in first." };

  const cart = await prisma.savedCart.findUnique({ where: { id: cartId } });
  if (!cart || cart.userId !== session.user.id) {
    return { success: false, error: "Cart not found." };
  }

  await prisma.savedCart.delete({ where: { id: cartId } });
  revalidatePath("/account/carts");
  return { success: true, data: undefined };
}

// ============ BOOKINGS, MESSAGES, REVIEWS (buyer-facing reads) ============
// Order history already has its own page (app/orders); these three didn't,
// even though the underlying data (Booking, Message, Review) already
// existed on User -- this just adds the buyer-scoped queries for them.

export async function listBookingsForBuyer() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.booking.findMany({
    where: { buyerId: session.user.id },
    include: {
      service: { select: { name: true, images: true } },
      store: { select: { name: true, slug: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });
}

export async function listConversationsForUser() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true, image: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listReviewsForUser() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.review.findMany({
    where: { authorId: session.user.id },
    include: {
      product: { select: { name: true, images: true } },
      service: { select: { name: true, images: true } },
      store: { select: { name: true, slug: true } },
      response: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// ============ ACCOUNT OVERVIEW ============

// Powers the dashboard landing page -- pulls counts across every existing
// and new customer-facing model in one call.
export async function getAccountOverview() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const [orderCount, bookingCount, wishlistCount, favoriteCount, reviewCount, unreadMessages] =
    await Promise.all([
      prisma.order.count({ where: { buyerId: userId } }),
      prisma.booking.count({ where: { buyerId: userId } }),
      prisma.wishlistItem.count({ where: { userId } }),
      prisma.favoriteBusiness.count({ where: { userId } }),
      prisma.review.count({ where: { authorId: userId } }),
      prisma.message.count({
        where: {
          conversation: { participants: { some: { userId } } },
          senderId: { not: userId },
          readAt: null,
        },
      }),
    ]);

  return { orderCount, bookingCount, wishlistCount, favoriteCount, reviewCount, unreadMessages };
}

// Store-scoped version, for the account overview a customer sees when
// they're inside a specific store (app/store/[slug]/account). Order/
// booking/review counts are filtered to that store; wishlist/favorites/
// messages stay account-wide since those aren't store-specific concepts.
export async function getAccountOverviewForStore(storeSlug: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const [orderCount, bookingCount, wishlistCount, reviewCount, defaultAddress, loyalty] =
    await Promise.all([
      prisma.order.count({ where: { buyerId: userId, store: { slug: storeSlug } } }),
      prisma.booking.count({ where: { buyerId: userId, store: { slug: storeSlug } } }),
      prisma.wishlistItem.count({ where: { userId } }),
      prisma.review.count({ where: { authorId: userId, store: { slug: storeSlug } } }),
      prisma.address.findFirst({ where: { userId, isDefault: true } }),
      prisma.loyaltyAccount.findUnique({ where: { userId } }),
    ]);

  return { orderCount, bookingCount, wishlistCount, reviewCount, defaultAddress, pointsBalance: loyalty?.pointsBalance ?? 0 };
}
