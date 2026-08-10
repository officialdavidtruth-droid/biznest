"use server";

import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { Store, Business, WebhookEventType } from "@prisma/client";
import { WEBHOOK_EVENT_TYPES, WEBHOOK_EVENT_NAMES } from "@/lib/webhooks/events";
import { redeliver } from "@/lib/webhooks/dispatch";

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

async function assertStoreAccess(slug: string): Promise<StoreAccessResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false, error: "You don't have access to this store." };

  return { success: true, store };
}

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

export async function listWebhookEndpoints(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.webhookEndpoint.findMany({
    where: { storeId: access.store.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function listWebhookDeliveries(slug: string, endpointId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, storeId: access.store.id },
  });
  if (!endpoint) return [];

  return prisma.webhookDelivery.findMany({
    where: { endpointId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Returns the plaintext secret once — it is never shown again after this. */
export async function createWebhookEndpoint(
  slug: string,
  url: string,
  events: WebhookEventType[]
): Promise<ActionResult<{ id: string; secret: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { success: false, error: "Enter a valid URL." };
  }
  if (parsed.protocol !== "https:") {
    return { success: false, error: "Webhook URLs must use https://." };
  }

  const invalid = events.filter((e) => !WEBHOOK_EVENT_TYPES.includes(e));
  if (invalid.length > 0) {
    return { success: false, error: "One or more selected events are invalid." };
  }

  const secret = generateSecret();
  const endpoint = await prisma.webhookEndpoint.create({
    data: { storeId: access.store.id, url, events, secret },
  });

  revalidatePath(`/store/${slug}/admin/settings`);
  return { success: true, data: { id: endpoint.id, secret } };
}

export async function updateWebhookEndpoint(
  slug: string,
  endpointId: string,
  updates: { url?: string; events?: WebhookEventType[]; isActive?: boolean }
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, storeId: access.store.id },
  });
  if (!endpoint) return { success: false, error: "Webhook endpoint not found." };

  if (updates.url) {
    try {
      const parsed = new URL(updates.url);
      if (parsed.protocol !== "https:") return { success: false, error: "Webhook URLs must use https://." };
    } catch {
      return { success: false, error: "Enter a valid URL." };
    }
  }

  await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      url: updates.url ?? undefined,
      events: updates.events ?? undefined,
      isActive: updates.isActive ?? undefined,
    },
  });

  revalidatePath(`/store/${slug}/admin/settings`);
  return { success: true, data: undefined };
}

/** Rotates the signing secret — old one stops verifying immediately. Returns the new plaintext secret once. */
export async function rotateWebhookSecret(
  slug: string,
  endpointId: string
): Promise<ActionResult<{ secret: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, storeId: access.store.id },
  });
  if (!endpoint) return { success: false, error: "Webhook endpoint not found." };

  const secret = generateSecret();
  await prisma.webhookEndpoint.update({ where: { id: endpointId }, data: { secret } });

  return { success: true, data: { secret } };
}

export async function deleteWebhookEndpoint(slug: string, endpointId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, storeId: access.store.id },
  });
  if (!endpoint) return { success: false, error: "Webhook endpoint not found." };

  await prisma.webhookEndpoint.delete({ where: { id: endpointId } });

  revalidatePath(`/store/${slug}/admin/settings`);
  return { success: true, data: undefined };
}

export async function retryWebhookDelivery(slug: string, deliveryId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const delivery = await prisma.webhookDelivery.findFirst({
    where: { id: deliveryId, endpoint: { storeId: access.store.id } },
  });
  if (!delivery) return { success: false, error: "Delivery not found." };

  await redeliver(deliveryId);
  revalidatePath(`/store/${slug}/admin/settings`);
  return { success: true, data: undefined };
}

export async function availableWebhookEvents(): Promise<{ type: WebhookEventType; name: string }[]> {
  return WEBHOOK_EVENT_TYPES.map((type) => ({ type, name: WEBHOOK_EVENT_NAMES[type] }));
}
