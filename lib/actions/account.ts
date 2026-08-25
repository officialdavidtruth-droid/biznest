"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { requireStoreCustomer, requireStoreCustomerByStoreId } from "@/lib/actions/store-customer";

// ============ ADDRESSES ============

export async function listAddresses() {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "CUSTOMER") return [];

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
  if (session.user.role === "CUSTOMER") return { success: false, error: "Customer accounts must use a store account." };

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
  if (session.user.role === "CUSTOMER") return { success: false, error: "Customer accounts must use a store-scoped account." };

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
  if (session.user.role === "CUSTOMER") return { success: false, error: "Customer accounts must use a store-scoped account." };

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
  if (session.user.role === "CUSTOMER") return [];

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

  const source = input.productId
    ? await prisma.product.findUnique({ where: { id: input.productId }, select: { storeId: true } })
    : await prisma.service.findUnique({ where: { id: input.serviceId! }, select: { storeId: true } });
  if (!source?.storeId) return { success: false, error: "Item not found." };
  if (session.user.role === "CUSTOMER") {
    const membership = await requireStoreCustomerByStoreId(source.storeId);
    if (!membership) return { success: false, error: "This customer account belongs to another store." };
  }
  await prisma.wishlistItem.create({
    data: { storeId: source.storeId, userId: session.user.id, productId: input.productId ?? null, serviceId: input.serviceId ?? null },
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

  const source = input.productId
    ? await prisma.product.findUnique({ where: { id: input.productId }, select: { storeId: true } })
    : await prisma.service.findUnique({ where: { id: input.serviceId! }, select: { storeId: true } });
  if (!source?.storeId) return;
  if (session.user.role === "CUSTOMER") {
    const membership = await requireStoreCustomerByStoreId(source.storeId);
    if (!membership) return;
  }
  await prisma.recentlyViewed.create({
    data: { storeId: source.storeId, userId: session.user.id, productId: input.productId ?? null, serviceId: input.serviceId ?? null },
  });

  // Keep only the most recent 50 per user so this table doesn't grow unbounded.
  const excess = await prisma.recentlyViewed.findMany({
    where: { userId: session.user.id, storeId: source.storeId },
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
  if (session.user.role === "CUSTOMER") return [];

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
  if (session.user.role === "CUSTOMER") return [];

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

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { store: { select: { id: true } } } });
  if (!business?.store?.id) return { success: false, error: "Business not found." };
  if (session.user.role === "CUSTOMER") {
    const membership = await requireStoreCustomerByStoreId(business.store.id);
    if (!membership) return { success: false, error: "This customer account belongs to another store." };
  }
  await prisma.favoriteBusiness.create({ data: { storeId: business.store.id, userId: session.user.id, businessId } });
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
  if (session.user.role === "CUSTOMER") {
    const membership = await requireStoreCustomerByStoreId(storeId);
    if (!membership) return { success: false, error: "This customer account does not belong to that store." };
  }

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
  if (session.user.role === "CUSTOMER") return [];

  return prisma.savedCart.findMany({
    where: { userId: session.user.id },
    include: { store: { select: { slug: true, name: true, logoUrl: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function deleteSavedCart(cartId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You need to sign in first." };
  if (session.user.role === "CUSTOMER") return { success: false, error: "Customer accounts must use a store-scoped account." };

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
  if (session.user.role === "CUSTOMER") return [];

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
  if (session.user.role === "CUSTOMER") return [];

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
  if (session.user.role === "CUSTOMER") return [];

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
  if (session.user.role === "CUSTOMER") return null;

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
  if (session.user.role === "CUSTOMER") return null;

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

// ============================================================================
// STORE CUSTOMER EXPERIENCE
// Everything below requires an explicit store slug. These are the only
// customer-facing account reads/writes used by /store/[slug]/account/*.
// A customer can never query another store's account data through these APIs.
// ============================================================================

async function getStoreCustomerContext(storeSlug: string) {
  return requireStoreCustomer(storeSlug);
}

export async function getStoreCustomerOverview(storeSlug: string) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return null;
  const [orders, bookings, wishlist, reviews, addresses, loyalty, unreadMessages] = await Promise.all([
    prisma.order.count({ where: { buyerId: ctx.userId, storeId: ctx.storeId } }),
    prisma.booking.count({ where: { buyerId: ctx.userId, storeId: ctx.storeId } }),
    prisma.wishlistItem.count({
      where: {
        userId: ctx.userId,
        storeId: ctx.storeId,
      },
    }),
    prisma.review.count({ where: { authorId: ctx.userId, storeId: ctx.storeId } }),
    prisma.storeCustomerAddress.findFirst({ where: { userId: ctx.userId, storeId: ctx.storeId, isDefault: true } }),
    prisma.storeLoyaltyAccount.findUnique({ where: { storeId_userId: { storeId: ctx.storeId, userId: ctx.userId } } }),
    prisma.message.count({
      where: {
        conversation: {
          storeId: ctx.storeId,
          participants: { some: { userId: ctx.userId } },
        },
        senderId: { not: ctx.userId },
        readAt: null,
      },
    }),
  ]);
  return { store: ctx.store, orderCount: orders, bookingCount: bookings, wishlistCount: wishlist, reviewCount: reviews, unreadMessages, defaultAddress: addresses, pointsBalance: loyalty?.pointsBalance ?? 0 };
}

export async function listStoreAddresses(storeSlug: string) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return [];
  return prisma.storeCustomerAddress.findMany({
    where: { userId: ctx.userId, storeId: ctx.storeId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function addStoreAddress(storeSlug: string, input: {
  label?: string; fullName: string; phone: string; line1: string; line2?: string;
  city: string; state: string; country?: string; isDefault?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return { success: false, error: "You don't have a customer account with this store." };
  if (!input.fullName || !input.phone || !input.line1 || !input.city || !input.state) {
    return { success: false, error: "Please fill in all required fields." };
  }
  if (input.isDefault) {
    await prisma.storeCustomerAddress.updateMany({ where: { userId: ctx.userId, storeId: ctx.storeId }, data: { isDefault: false } });
  }
  const address = await prisma.storeCustomerAddress.create({ data: { ...input, userId: ctx.userId, storeId: ctx.storeId } });
  revalidatePath(`/store/${storeSlug}/account/addresses`);
  return { success: true, data: { id: address.id } };
}

export async function deleteStoreAddress(storeSlug: string, addressId: string): Promise<ActionResult> {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return { success: false, error: "You don't have a customer account with this store." };
  const address = await prisma.storeCustomerAddress.findFirst({ where: { id: addressId, userId: ctx.userId, storeId: ctx.storeId } });
  if (!address) return { success: false, error: "Address not found." };
  await prisma.storeCustomerAddress.delete({ where: { id: address.id } });
  revalidatePath(`/store/${storeSlug}/account/addresses`);
  return { success: true, data: undefined };
}

export async function setDefaultStoreAddress(storeSlug: string, addressId: string): Promise<ActionResult> {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return { success: false, error: "You don't have a customer account with this store." };
  const address = await prisma.storeCustomerAddress.findFirst({ where: { id: addressId, userId: ctx.userId, storeId: ctx.storeId } });
  if (!address) return { success: false, error: "Address not found." };
  await prisma.$transaction([
    prisma.storeCustomerAddress.updateMany({ where: { userId: ctx.userId, storeId: ctx.storeId }, data: { isDefault: false } }),
    prisma.storeCustomerAddress.update({ where: { id: address.id }, data: { isDefault: true } }),
  ]);
  revalidatePath(`/store/${storeSlug}/account/addresses`);
  return { success: true, data: undefined };
}

export async function toggleStoreWishlist(storeSlug: string, input: { productId?: string; serviceId?: string }): Promise<ActionResult<{ wishlisted: boolean }>> {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return { success: false, error: "You don't have a customer account with this store." };
  if (!input.productId && !input.serviceId) return { success: false, error: "No item specified." };

  const validProduct = input.productId ? await prisma.product.findFirst({ where: { id: input.productId, storeId: ctx.storeId }, select: { id: true } }) : null;
  const validService = input.serviceId ? await prisma.service.findFirst({ where: { id: input.serviceId, storeId: ctx.storeId }, select: { id: true } }) : null;
  if ((input.productId && !validProduct) || (input.serviceId && !validService)) return { success: false, error: "That item doesn't belong to this store." };

  const existing = await prisma.wishlistItem.findFirst({ where: { userId: ctx.userId, storeId: ctx.storeId, productId: input.productId ?? null, serviceId: input.serviceId ?? null } });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath(`/store/${storeSlug}/account/wishlist`);
    return { success: true, data: { wishlisted: false } };
  }
  await prisma.wishlistItem.create({ data: { storeId: ctx.storeId, userId: ctx.userId, productId: input.productId ?? null, serviceId: input.serviceId ?? null } });
  revalidatePath(`/store/${storeSlug}/account/wishlist`);
  return { success: true, data: { wishlisted: true } };
}

export async function listStoreBookings(storeSlug: string) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return [];
  return prisma.booking.findMany({ where: { buyerId: ctx.userId, storeId: ctx.storeId }, include: { service: { select: { name: true, images: true } } }, orderBy: { scheduledAt: "desc" } });
}

export async function listStoreReviews(storeSlug: string) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return [];
  return prisma.review.findMany({ where: { authorId: ctx.userId, storeId: ctx.storeId }, include: { product: { select: { name: true, images: true } }, service: { select: { name: true, images: true } }, response: true }, orderBy: { createdAt: "desc" } });
}

export async function listStoreConversations(storeSlug: string) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return [];
  return prisma.conversation.findMany({
    where: { storeId: ctx.storeId, participants: { some: { userId: ctx.userId } } },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, participants: { select: { userId: true, user: { select: { name: true, image: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

// The customer's one general (non-order) "contact the store" thread, with
// the full message history — used to render the complaint box on the
// Support page. Order-tied threads are surfaced through the dispute list
// instead, each linking to its own /disputes/[orderId] page.
export async function getGeneralStoreConversation(storeSlug: string) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return null;
  return prisma.conversation.findFirst({
    where: { storeId: ctx.storeId, orderId: null, participants: { some: { userId: ctx.userId } } },
    include: { messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } } },
  });
}

// Every dispute the customer has raised (or that was raised against an
// order of theirs) at this store, regardless of which order it's attached
// to. Distinct from listStoreConversations: a dispute is a formal,
// order-tied case with evidence + admin resolution, not a free-form chat.
export async function listStoreDisputes(storeSlug: string) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return [];
  return prisma.dispute.findMany({
    where: { order: { buyerId: ctx.userId, storeId: ctx.storeId } },
    include: { order: { select: { id: true, total: true, currency: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// General "contact the store" conversation — deliberately NOT tied to an
// order, so a customer can reach the seller even when they can't see (or
// don't have) the order in question, e.g. "I was charged but my order
// history is empty" or any complaint that isn't about one specific order.
// One general conversation per customer per store; reused on repeat visits
// rather than spawning a new thread every time (Conversation.orderId is
// nullable/unique, so unlike order-tied threads this can't be looked up by
// orderId — it's identified by storeId + participant instead).
async function getOrCreateGeneralConversation(storeId: string, buyerId: string, sellerId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { storeId, orderId: null, participants: { every: { userId: { in: [buyerId, sellerId] } } } },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: { storeId, participants: { create: [{ userId: buyerId }, { userId: sellerId }] } },
  });
}

export async function startStoreConversation(storeSlug: string, message: string): Promise<ActionResult> {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return { success: false, error: "You don't have access to this store account." };
  if (!message.trim()) return { success: false, error: "Message can't be empty." };

  const store = await prisma.store.findUnique({ where: { id: ctx.storeId }, include: { business: { select: { userId: true } } } });
  if (!store) return { success: false, error: "Store not found." };

  const conversation = await getOrCreateGeneralConversation(ctx.storeId, ctx.userId, store.business.userId);
  await prisma.message.create({ data: { conversationId: conversation.id, senderId: ctx.userId, content: message.trim() } });
  await prisma.notification
    .create({
      data: {
        userId: store.business.userId,
        type: "MESSAGE",
        title: "New message from a customer",
        body: message.trim().slice(0, 140),
      },
    })
    .catch(() => {});

  revalidatePath(`/store/${storeSlug}/account/messages`);
  return { success: true, data: { conversationId: conversation.id } };
}

export async function sendStoreMessage(storeSlug: string, conversationId: string, content: string): Promise<ActionResult> {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return { success: false, error: "You don't have access to this store account." };
  if (!content.trim()) return { success: false, error: "Message can't be empty." };

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, storeId: ctx.storeId, participants: { some: { userId: ctx.userId } } },
    include: { store: { include: { business: { select: { userId: true } } } } },
  });
  if (!conversation) return { success: false, error: "Conversation not found." };

  await prisma.message.create({ data: { conversationId, senderId: ctx.userId, content: content.trim() } });
  if (conversation.store) {
    await prisma.notification
      .create({
        data: {
          userId: conversation.store.business.userId,
          type: "MESSAGE",
          title: "New message from a customer",
          body: content.trim().slice(0, 140),
        },
      })
      .catch(() => {});
  }

  revalidatePath(`/store/${storeSlug}/account/messages`);
  return { success: true, data: undefined };
}

export async function listStoreRecentlyViewed(storeSlug: string, limit = 20) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return [];
  return prisma.recentlyViewed.findMany({ where: { userId: ctx.userId, storeId: ctx.storeId }, include: { product: true, service: true }, orderBy: { viewedAt: "desc" }, take: limit });
}

export async function listStoreSavedCart(storeSlug: string) {
  const ctx = await getStoreCustomerContext(storeSlug);
  if (!ctx) return null;
  return prisma.savedCart.findUnique({ where: { userId_storeId: { userId: ctx.userId, storeId: ctx.storeId } } });
}