import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Customer data rights for a storefront account: a downloadable copy of what the store holds, and account
 * deletion. Deletion removes the person's details but keeps order, booking and payment records (the business
 * must retain them for its own accounts and refunds), so they remain attached to an anonymous "Deleted customer".
 */

const OPEN_ORDER = ["PENDING_PAYMENT", "PAID", "IN_PROGRESS", "DISPUTED"] as const;
const FINISHED_ORDER = ["COMPLETED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;
const OPEN_BOOKING = ["PENDING", "CONFIRMED", "CHECKED_IN", "SEATED"] as const;

export async function buildCustomerExport(userId: string, storeId: string) {
  const [user, store, profile, addresses, orders, bookings, reviews, wishlist, loyalty, wallet, messages] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true, createdAt: true } }),
    prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }),
    prisma.storeCustomerProfile.findFirst({ where: { storeId, userId }, select: { name: true, email: true, phone: true, preferences: true, createdAt: true } }),
    prisma.storeCustomerAddress.findMany({ where: { storeId, userId } }),
    prisma.order.findMany({ where: { storeId, buyerId: userId }, orderBy: { createdAt: "desc" }, take: 1000, select: { id: true, createdAt: true, status: true, total: true, currency: true, shippingAddress: true, items: { select: { quantity: true, unitPrice: true, product: { select: { name: true } }, service: { select: { name: true } } } } } }),
    prisma.booking.findMany({ where: { storeId, buyerId: userId }, orderBy: { createdAt: "desc" }, take: 1000, select: { id: true, referenceCode: true, createdAt: true, scheduledAt: true, status: true, paymentStatus: true, paymentAmount: true, paymentCurrency: true, notes: true, service: { select: { name: true } } } }),
    prisma.review.findMany({ where: { storeId, authorId: userId }, select: { rating: true, comment: true, createdAt: true } }),
    prisma.wishlistItem.count({ where: { storeId, userId } }),
    prisma.storeLoyaltyAccount.findUnique({ where: { storeId_userId: { storeId, userId } }, select: { pointsBalance: true } }),
    prisma.storeWallet.findFirst({ where: { storeId, userId }, select: { balance: true, currency: true } }),
    prisma.message.findMany({ where: { senderId: userId, conversation: { storeId } }, orderBy: { createdAt: "desc" }, take: 1000, select: { content: true, createdAt: true } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    store: store?.name ?? null,
    account: user,
    profile,
    addresses,
    orders: orders.map((o) => ({ ...o, total: Number(o.total), items: o.items.map((i) => ({ name: i.product?.name ?? i.service?.name ?? "Item", quantity: i.quantity, unitPrice: Number(i.unitPrice) })) })),
    bookings: bookings.map((b) => ({ ...b, paymentAmount: b.paymentAmount == null ? null : Number(b.paymentAmount) })),
    reviews,
    savedItems: wishlist,
    rewardPoints: loyalty?.pointsBalance ?? 0,
    messagesSent: messages,
    wallet: wallet ? { balance: Number(wallet.balance), currency: wallet.currency } : null,
  };
}

export type DeleteResult = { success: true } | { success: false; error: string };

/** Verifies the password and anonymises the customer account of this store. Never touches owners, staff or other stores' accounts. */
export async function deleteStoreCustomerAccount(userId: string, storeId: string, password: string): Promise<DeleteResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, customerScopeStoreId: true, passwordHash: true } });
  if (!user || user.role !== "CUSTOMER" || user.customerScopeStoreId !== storeId) return { success: false, error: "This account can't be deleted here." };
  if (!user.passwordHash || !(await bcrypt.compare(String(password ?? ""), user.passwordHash))) return { success: false, error: "That password isn't right." };

  const [openOrders, openBookings] = await Promise.all([
    prisma.order.count({ where: { storeId, buyerId: userId, status: { in: [...OPEN_ORDER] } } }),
    prisma.booking.count({ where: { storeId, buyerId: userId, status: { in: [...OPEN_BOOKING] } } }),
  ]);
  if (openOrders > 0) return { success: false, error: "You still have an order in progress. Delete your account once it is completed or cancelled." };
  if (openBookings > 0) return { success: false, error: "You still have an upcoming booking. Cancel it or wait until it is done, then delete your account." };

  const newHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  try {
    await prisma.$transaction(async (tx) => {
      // Checked and closed in the same transaction, so a top-up or wallet payment landing a moment
      // ago can't leave money stranded in a deleted account. Closing the wallet also makes any
      // top-up still in flight fail to settle (it stays pending for staff) instead of crediting a dead account.
      const wallet = await tx.storeWallet.findFirst({ where: { storeId, userId }, select: { id: true, balance: true, currency: true } });
      if (wallet && Number(wallet.balance) > 0) throw new WalletNotEmpty(`${wallet.currency} ${Number(wallet.balance).toLocaleString()}`);
      if (wallet) await tx.storeWallet.update({ where: { id: wallet.id }, data: { status: "CLOSED" }, select: { id: true } });

      // Delivery details on finished orders belong to the person: blank them, keep the area for the store's own reports.
      const finished = await tx.order.findMany({ where: { storeId, buyerId: userId, status: { in: [...FINISHED_ORDER] } }, select: { id: true, shippingAddress: true } });
      for (const o of finished) {
        if (!o.shippingAddress) continue;
        const a = (o.shippingAddress ?? {}) as Record<string, unknown>;
        await tx.order.update({ where: { id: o.id }, data: { shippingAddress: { fullName: "Deleted customer", phone: "", address: "", city: a.city ?? "", state: a.state ?? "", country: a.country ?? "" } }, select: { id: true } });
      }

      await tx.storeCustomerAddress.deleteMany({ where: { storeId, userId } });
      await tx.wishlistItem.deleteMany({ where: { storeId, userId } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.verificationToken.deleteMany({ where: { identifier: userId } });
      await tx.storeCustomerProfile.deleteMany({ where: { storeId, userId } });
      await tx.booking.updateMany({ where: { storeId, buyerId: userId }, data: { guestName: null, guestPhone: null, guestEmail: null, emergencyContactName: null, emergencyContactPhone: null } });
      await tx.review.updateMany({ where: { storeId, authorId: userId }, data: { comment: null } });
      // Keep the row (orders, bookings and payments point at it) but strip everything personal and make it impossible to sign in to.
      await tx.user.update({
        where: { id: userId },
        data: { name: "Deleted customer", email: `deleted-${userId}@deleted.invalid`, phone: null, image: null, passwordHash: newHash, isBanned: true, bannedReason: "Account deleted by the customer", sessionsInvalidatedAt: new Date() },
        select: { id: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (err) {
    if (err instanceof WalletNotEmpty) return { success: false, error: `Spend your wallet balance (${err.amount}) on an order or booking before deleting your account, or contact the store to have it returned.` };
    throw err;
  }
  return { success: true };
}

class WalletNotEmpty extends Error {
  constructor(public amount: string) { super("WALLET_NOT_EMPTY"); }
}
