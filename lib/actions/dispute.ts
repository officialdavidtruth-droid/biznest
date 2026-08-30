"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStoreCustomerByStoreId } from "@/lib/actions/store-customer";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { DISPUTABLE_ORDER_STATUSES, type DisputeViewerRole } from "@/lib/constants/dispute";
import { getStoreAccessRole, hasStorePermission } from "@/lib/access/store-access";

async function assertOrderParticipant(orderId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: { include: { business: true } } },
  });
  if (!order) return { success: false as const, error: "Order not found." };

  const isBuyer = order.buyerId === session.user.id;
  if (isBuyer && session.user.role === "CUSTOMER") {
    const membership = await requireStoreCustomerByStoreId(order.storeId);
    if (!membership) return { success: false as const, error: "You don't have access to this store account." };
  }
  // "Seller side" also covers a MANAGER/STAFF granted "orders" access —
  // disputes are reachable from the Orders page (see dashboard-nav.ts),
  // so a staff member with that permission should be able to act on them,
  // not just the store owner.
  const isOwner = order.store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  let isSeller = isOwner || isStaff;
  if (!isSeller) {
    const role = await getStoreAccessRole(session.user.id, session.user.role, order.store);
    if (role === "MANAGER" || role === "STAFF") {
      const staffMembership = await prisma.storeStaff.findFirst({
        where: { storeId: order.storeId, userId: session.user.id, status: "ACTIVE" },
        select: { permissions: true },
      });
      isSeller = hasStorePermission(role, staffMembership?.permissions, "orders");
    }
  }
  if (!isBuyer && !isSeller && !isStaff) {
    return { success: false as const, error: "You don't have access to this order." };
  }

  // Staff viewing through their own user account (not the /supaadmin PIN
  // panel) see it as a neutral observer — treated as "seller" for the
  // purposes of which side of the thread their own messages appear on
  // doesn't apply to them since they can't post evidence/messages below,
  // only the two real participants can.
  const viewer: DisputeViewerRole = isBuyer ? "buyer" : "seller";
  return { success: true as const, order, userId: session.user.id, viewer, isBuyer, isSeller };
}

async function getOrCreateConversation(orderId: string, storeId: string, buyerId: string, sellerId: string) {
  const existing = await prisma.conversation.findUnique({ where: { orderId } });
  if (existing) return existing;
  return prisma.conversation.create({
    data: {
      orderId,
      storeId,
      participants: { create: [{ userId: buyerId }, { userId: sellerId }] },
    },
  });
}

async function notifyOtherParty(orderId: string, currentUserId: string, buyerId: string, sellerId: string, title: string, body: string) {
  const otherPartyId = currentUserId === buyerId ? sellerId : buyerId;
  // Best-effort — a failed notification should never block the dispute
  // action itself from succeeding.
  await prisma.notification
    .create({ data: { userId: otherPartyId, type: "DISPUTE", title, body } })
    .catch(() => {});
}

// --- Read ------------------------------------------------------------------

export async function getDisputeThread(orderId: string) {
  const access = await assertOrderParticipant(orderId);
  if (!access.success) return null;

  const [order, dispute, statusEvents, payments] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true, service: true } },
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        deliveryZone: true,
        store: {
          select: {
            name: true,
            slug: true,
            contactEmail: true,
            contactPhone: true,
            business: { select: { userId: true, businessName: true, phone: true, email: true } },
          },
        },
      },
    }),
    prisma.dispute.findUnique({
      where: { orderId },
      include: {
        raisedBy: { select: { id: true, name: true, email: true } },
        evidence: {
          include: { submittedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.orderStatusEvent.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!order) return null;

  let messages: Array<
    Awaited<ReturnType<typeof prisma.message.findMany>>[number] & {
      sender: { id: string; name: string | null };
    }
  > = [];
  if (dispute) {
    const conversation = await prisma.conversation.findUnique({
      where: { orderId },
      include: { messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } } },
    });
    messages = conversation?.messages ?? [];
  }

  return {
    viewer: access.viewer,
    viewerId: access.userId,
    canOpen: !dispute && (DISPUTABLE_ORDER_STATUSES as readonly string[]).includes(order.status),
    order,
    dispute,
    statusEvents,
    payments,
    messages,
  };
}

// --- Write -------------------------------------------------------------

export async function openDispute(orderId: string, reason: string): Promise<ActionResult> {
  const access = await assertOrderParticipant(orderId);
  if (!access.success) return { success: false, error: access.error };
  if (!access.isBuyer && !access.isSeller) {
    return { success: false, error: "Only the buyer or the seller can open a dispute." };
  }
  if (!reason.trim()) return { success: false, error: "Tell us what went wrong." };

  if (!(DISPUTABLE_ORDER_STATUSES as readonly string[]).includes(access.order.status)) {
    return {
      success: false,
      error: `Orders in ${access.order.status.replace("_", " ").toLowerCase()} status can't be disputed.`,
    };
  }

  const existing = await prisma.dispute.findUnique({ where: { orderId } });
  if (existing) return { success: false, error: "A dispute has already been opened for this order." };

  const buyerId = access.order.buyerId;
  const sellerId = access.order.store.business.userId;

  await prisma.$transaction([
    prisma.dispute.create({ data: { orderId, raisedById: access.userId, reason: reason.trim(), status: "OPEN" } }),
    prisma.order.update({ where: { id: orderId }, data: { status: "DISPUTED" } }),
    prisma.orderStatusEvent.create({ data: { orderId, status: "DISPUTED", note: "Dispute opened" } }),
  ]);
  await getOrCreateConversation(orderId, access.order.store.id, buyerId, sellerId);

  await notifyOtherParty(
    orderId,
    access.userId,
    buyerId,
    sellerId,
    "A dispute was opened",
    `Order #${orderId.slice(-8).toUpperCase()} has an open dispute and needs your response.`
  );
  await prisma.auditLog
    .create({ data: { userId: access.userId, action: "DISPUTE_OPENED", entity: "Dispute", entityId: orderId } })
    .catch(() => {});

  revalidatePath(`/disputes/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/store/${access.order.store.slug}/admin/orders/${orderId}`);
  revalidatePath(`/store/${access.order.store.slug}/admin/orders`);
  return { success: true, data: undefined };
}

export async function addDisputeEvidence(
  orderId: string,
  input: { fileUrl?: string; note?: string }
): Promise<ActionResult> {
  const access = await assertOrderParticipant(orderId);
  if (!access.success) return { success: false, error: access.error };
  if (!access.isBuyer && !access.isSeller) {
    return { success: false, error: "Only the buyer or the seller can submit evidence." };
  }
  if (!input.fileUrl && !input.note?.trim()) {
    return { success: false, error: "Add a photo, file, or a note." };
  }

  const dispute = await prisma.dispute.findUnique({ where: { orderId } });
  if (!dispute) return { success: false, error: "No dispute is open for this order." };
  if (dispute.status !== "OPEN" && dispute.status !== "UNDER_REVIEW") {
    return { success: false, error: "This dispute is already resolved — evidence can no longer be added." };
  }

  await prisma.disputeEvidence.create({
    data: {
      disputeId: dispute.id,
      submittedById: access.userId,
      fileUrl: input.fileUrl || null,
      note: input.note?.trim() || null,
    },
  });

  await notifyOtherParty(
    orderId,
    access.userId,
    access.order.buyerId,
    access.order.store.business.userId,
    "New evidence submitted",
    `New evidence was added to the dispute for order #${orderId.slice(-8).toUpperCase()}.`
  );

  revalidatePath(`/disputes/${orderId}`);
  return { success: true, data: undefined };
}

export async function sendDisputeMessage(orderId: string, content: string): Promise<ActionResult> {
  const access = await assertOrderParticipant(orderId);
  if (!access.success) return { success: false, error: access.error };
  if (!access.isBuyer && !access.isSeller) {
    return { success: false, error: "Only the buyer or the seller can message on this dispute." };
  }
  if (!content.trim()) return { success: false, error: "Message can't be empty." };

  const dispute = await prisma.dispute.findUnique({ where: { orderId } });
  if (!dispute) return { success: false, error: "No dispute is open for this order." };
  if (dispute.status === "CLOSED") {
    return { success: false, error: "This dispute is closed — no further messages can be sent." };
  }

  const conversation = await getOrCreateConversation(orderId, access.order.store.id, access.order.buyerId, access.order.store.business.userId);
  await prisma.message.create({
    data: { conversationId: conversation.id, senderId: access.userId, content: content.trim() },
  });

  await notifyOtherParty(
    orderId,
    access.userId,
    access.order.buyerId,
    access.order.store.business.userId,
    "New message on your dispute",
    content.trim().slice(0, 140)
  );

  revalidatePath(`/disputes/${orderId}`);
  return { success: true, data: undefined };
}
