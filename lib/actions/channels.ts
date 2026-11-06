"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { hasCapability } from "@/lib/capabilities";
import { getPluginEntitlement } from "@/lib/plugins";
import { assertSafeUrl } from "@/lib/security/safe-fetch";
import { syncConnection } from "@/lib/channels/sync";
import { deliverPush, enqueueConnectionPush } from "@/lib/channels/push";
import { newLiveCredentials, safePushUrl } from "@/lib/channels/live";
import type { ActionResult } from "@/types/actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.space";

const CHANNEL_PROVIDERS = {
  BOOKING_COM: "Booking.com",
  AIRBNB: "Airbnb",
  EXPEDIA: "Expedia",
  VRBO: "Vrbo",
  AGODA: "Agoda",
  TRIPADVISOR: "Tripadvisor",
  OTHER: "Other channel",
} as const;
type ProviderKey = keyof typeof CHANNEL_PROVIDERS;

/** Same gate as the PMS workspace: hotel/property business, PMS entitled and installed. */
async function access(slug: string) {
  const a = await assertStorePermission(slug, "plugin:pms");
  if (!a.success) return a;
  if (!hasCapability(a.store.business.category, "pms")) {
    return { success: false as const, error: "Channel sync is only available to hotel and property businesses." };
  }
  const entitlement = await getPluginEntitlement(a.store.id, "pms");
  if (!entitlement.allowed) return { success: false as const, error: entitlement.reason };
  if (!entitlement.installed) return { success: false as const, error: "Install BizNest PMS from Apps first." };
  return a;
}

export type ChannelConnectionView = {
  id: string;
  roomId: string;
  roomName: string;
  provider: string;
  providerLabel: string;
  label: string | null;
  importUrl: string | null;
  exportUrl: string;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  blockCount: number;
  live: {
    enabled: boolean;
    hookUrl: string | null;
    secret: string | null;
    pushUrl: string | null;
    lastPushAt: string | null;
    lastPushStatus: string | null;
    lastPushMessage: string | null;
    lastHookAt: string | null;
    pending: number;
    failed: number;
  };
};

export type ChannelManagerRequestView = { id: string; provider: string; propertyCode: string | null; status: string; createdAt: string };

export async function getChannelData(slug: string) {
  const a = await access(slug);
  if (!a.success) return null;
  const [connections, requests] = await Promise.all([
    prisma.channelConnection.findMany({
      where: { storeId: a.store.id },
      include: { room: { select: { name: true } }, pushes: { where: { status: { in: ["PENDING", "FAILED"] } }, select: { status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.channelManagerRequest.findMany({ where: { storeId: a.store.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const connectionViews: ChannelConnectionView[] = connections.map((c) => ({
    id: c.id,
    roomId: c.roomId,
    roomName: c.room.name,
    provider: c.provider,
    providerLabel: CHANNEL_PROVIDERS[c.provider as ProviderKey] ?? c.provider,
    label: c.label,
    importUrl: c.importUrl,
    exportUrl: `${APP_URL}/api/channels/ical/${c.exportToken}`,
    isActive: c.isActive,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: c.lastSyncStatus,
    lastSyncMessage: c.lastSyncMessage,
    blockCount: c.lastBlockCount,
    live: {
      enabled: !!(c.hookToken && c.liveSecret),
      hookUrl: c.hookToken ? `${APP_URL}/api/channels/hook/${c.hookToken}` : null,
      secret: c.liveSecret,
      pushUrl: c.pushUrl,
      lastPushAt: c.lastPushAt?.toISOString() ?? null,
      lastPushStatus: c.lastPushStatus,
      lastPushMessage: c.lastPushMessage,
      lastHookAt: c.lastHookAt?.toISOString() ?? null,
      pending: c.pushes.filter((p) => p.status === "PENDING").length,
      failed: c.pushes.filter((p) => p.status === "FAILED").length,
    },
  }));
  const requestViews: ChannelManagerRequestView[] = requests.map((r) => ({
    id: r.id,
    provider: r.provider,
    propertyCode: r.propertyCode,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
  return { connections: connectionViews, requests: requestViews };
}

function normalizeImportUrl(raw: string | undefined): { ok: true; url: string | null } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, url: null };
  // Many channels hand out webcal:// links; they are plain https underneath.
  const candidate = trimmed.replace(/^webcal:\/\//i, "https://");
  try {
    const url = assertSafeUrl(candidate);
    if (url.protocol !== "https:") return { ok: false, error: "The calendar link must start with https:// (or webcal://)." };
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, error: "That calendar link is not allowed or not a valid URL." };
  }
}

export async function createChannelConnection(
  slug: string,
  input: { roomId: string; provider: string; label?: string; importUrl?: string },
): Promise<ActionResult<{ id: string; exportUrl: string; sync?: { ok: boolean; blocks: number; error?: string } }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  if (!(input.provider in CHANNEL_PROVIDERS)) return { success: false, error: "Choose a channel." };

  const room = await prisma.propertyRoom.findFirst({ where: { id: input.roomId, storeId: a.store.id }, select: { id: true } });
  if (!room) return { success: false, error: "Room not found." };

  const url = normalizeImportUrl(input.importUrl);
  if (!url.ok) return { success: false, error: url.error };

  const existing = await prisma.channelConnection.count({ where: { storeId: a.store.id } });
  if (existing >= 200) return { success: false, error: "Connection limit reached." };

  const created = await prisma.channelConnection.create({
    data: {
      storeId: a.store.id,
      roomId: room.id,
      provider: input.provider,
      label: input.label?.trim().slice(0, 80) || null,
      importUrl: url.url,
      exportToken: crypto.randomBytes(24).toString("hex"),
    },
  });

  // First pull right away so the owner immediately sees whether the link works.
  const sync = url.url ? await syncConnection(created.id) : undefined;
  revalidatePath(`/store/${slug}/admin/pms`);
  return {
    success: true,
    data: { id: created.id, exportUrl: `${APP_URL}/api/channels/ical/${created.exportToken}`, sync: sync ? { ok: sync.ok, blocks: sync.blocks, error: sync.error } : undefined },
  };
}

export async function syncChannelNow(slug: string, connectionId: string): Promise<ActionResult<{ blocks: number; conflicts: number }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const conn = await prisma.channelConnection.findFirst({ where: { id: connectionId, storeId: a.store.id }, select: { id: true } });
  if (!conn) return { success: false, error: "Connection not found." };
  const result = await syncConnection(conn.id);
  revalidatePath(`/store/${slug}/admin/pms`);
  if (!result.ok) return { success: false, error: result.error ?? "Sync failed." };
  return { success: true, data: { blocks: result.blocks, conflicts: result.conflicts } };
}

export async function setChannelActive(slug: string, connectionId: string, isActive: boolean): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.channelConnection.updateMany({ where: { id: connectionId, storeId: a.store.id }, data: { isActive } });
  if (res.count === 0) return { success: false, error: "Connection not found." };
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

export async function deleteChannelConnection(slug: string, connectionId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.channelConnection.deleteMany({ where: { id: connectionId, storeId: a.store.id } });
  if (res.count === 0) return { success: false, error: "Connection not found." };
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

/* ------------------------------ live two-way link ------------------------------ */

async function ownConnection(slug: string, connectionId: string) {
  const a = await access(slug);
  if (!a.success) return { error: a.error } as const;
  const conn = await prisma.channelConnection.findFirst({ where: { id: connectionId, storeId: a.store.id } });
  if (!conn) return { error: "Connection not found." } as const;
  return { a, conn } as const;
}

/** Create the inbound webhook address and the signing secret (once). */
export async function enableLiveChannel(slug: string, connectionId: string): Promise<ActionResult> {
  const r = await ownConnection(slug, connectionId);
  if ("error" in r) return { success: false, error: r.error };
  if (r.conn.hookToken && r.conn.liveSecret) return { success: true, data: undefined };
  await prisma.channelConnection.update({ where: { id: r.conn.id }, data: newLiveCredentials() });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

/** Set (or clear, with an empty string) the https address we POST availability to. */
export async function saveChannelPushUrl(slug: string, connectionId: string, rawUrl: string): Promise<ActionResult> {
  const r = await ownConnection(slug, connectionId);
  if ("error" in r) return { success: false, error: r.error };
  const trimmed = rawUrl.trim();
  let pushUrl: string | null = null;
  if (trimmed) {
    pushUrl = safePushUrl(trimmed);
    if (!pushUrl) return { success: false, error: "The push address must be a valid https:// link." };
    try { assertSafeUrl(pushUrl); } catch { return { success: false, error: "That address is not allowed." }; }
  }
  await prisma.channelConnection.update({
    where: { id: r.conn.id },
    data: { pushUrl, ...(pushUrl && !(r.conn.hookToken && r.conn.liveSecret) ? newLiveCredentials() : {}) },
  });
  if (pushUrl) {
    const id = await enqueueConnectionPush(r.conn.id);
    if (id) await deliverPush(id).catch(() => undefined);
  } else {
    await prisma.channelPush.deleteMany({ where: { connectionId: r.conn.id, status: "PENDING" } });
  }
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

/** New secret and webhook address. The old ones stop working immediately. */
export async function rotateLiveSecret(slug: string, connectionId: string): Promise<ActionResult> {
  const r = await ownConnection(slug, connectionId);
  if ("error" in r) return { success: false, error: r.error };
  await prisma.channelConnection.update({ where: { id: r.conn.id }, data: newLiveCredentials() });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

/** Send a full availability snapshot now (also retries anything that failed). */
export async function sendChannelPushNow(slug: string, connectionId: string, kind: "test" | "retry" = "retry"): Promise<ActionResult<{ message: string }>> {
  const r = await ownConnection(slug, connectionId);
  if ("error" in r) return { success: false, error: r.error };
  if (!r.conn.pushUrl || !r.conn.liveSecret) return { success: false, error: "Add a push address first." };
  const id = await enqueueConnectionPush(r.conn.id, kind === "test" ? "test" : "availability.updated");
  if (!id) return { success: false, error: "Live push is not set up for this channel." };
  const ok = await deliverPush(id);
  revalidatePath(`/store/${slug}/admin/pms`);
  if (ok) return { success: true, data: { message: "Delivered." } };
  const fresh = await prisma.channelConnection.findUnique({ where: { id: r.conn.id }, select: { lastPushMessage: true } });
  return { success: false, error: fresh?.lastPushMessage ?? "Delivery failed." };
}

/** Hotel asks BizNest to connect it to a certified channel manager such as RateTiger. */
export async function requestChannelManager(
  slug: string,
  input: { provider: "RATETIGER" | "OTHER"; propertyCode?: string; contactEmail: string; notes?: string },
): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const email = input.contactEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Enter a valid contact email." };
  const open = await prisma.channelManagerRequest.count({ where: { storeId: a.store.id, provider: input.provider, status: { in: ["REQUESTED", "IN_PROGRESS"] } } });
  if (open > 0) return { success: false, error: "You already have an open request for this channel manager." };
  await prisma.channelManagerRequest.create({
    data: {
      storeId: a.store.id,
      provider: input.provider,
      propertyCode: input.propertyCode?.trim().slice(0, 80) || null,
      contactEmail: email.slice(0, 200),
      notes: input.notes?.trim().slice(0, 1000) || null,
    },
  });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}
