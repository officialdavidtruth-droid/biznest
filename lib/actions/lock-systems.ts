"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { APP_URL } from "@/lib/constants/app-url";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { encryptSecret } from "@/lib/payments/store-gateway";
import { getToken, listLocks, md5 } from "@/lib/locks/ttlock";
import { getTtlockSession, issueStayAccess, revokeStayAccess } from "@/lib/locks/grants";
import { listAccessGroups, listAcsSystems } from "@/lib/locks/seam";
import { decryptSecret } from "@/lib/payments/store-gateway";
import type { ActionResult } from "@/types/actions";

export type LockSystemView = {
  provider: "TTLOCK" | "BRIDGE" | "SEAM" | null;
  seamSystemId: string | null;
  ttUsername: string | null;
  ttClientId: string | null;
  bridgeUrl: string | null;
  bridgeLastSeenAt: string | null;
  lastError: string | null;
  roomLocks: { roomId: string; lockId: string; lockLabel: string | null }[];
  grants: { id: string; roomName: string; guestName: string; passcode: string | null; status: string; endsAt: string; error: string | null; reservationId: string }[];
};

const access = (slug: string) => assertStorePermission(slug, "plugin:pms");

export async function getLockSystem(slug: string): Promise<LockSystemView | null> {
  const a = await access(slug);
  if (!a.success) return null;
  const [integration, roomLocks, grants] = await Promise.all([
    prisma.lockIntegration.findUnique({ where: { storeId: a.store.id } }),
    prisma.roomLock.findMany({ where: { storeId: a.store.id } }),
    prisma.stayAccessGrant.findMany({
      where: { storeId: a.store.id, status: { in: ["PENDING", "ACTIVE", "FAILED", "REVOKE_PENDING"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const reservationIds = [...new Set(grants.map((g) => g.reservationId))];
  const reservations = reservationIds.length
    ? await prisma.propertyReservation.findMany({ where: { id: { in: reservationIds } }, select: { id: true, room: { select: { name: true } }, guest: { select: { fullName: true } } } })
    : [];
  const byId = new Map(reservations.map((r) => [r.id, r]));
  return {
    provider: integration?.provider ?? null,
    seamSystemId: integration?.seamSystemId ?? null,
    ttUsername: integration?.ttUsername ?? null,
    ttClientId: integration?.ttClientId ?? null,
    bridgeUrl: integration?.bridgeToken ? `${APP_URL}/api/pms/bridge/${integration.bridgeToken}/jobs` : null,
    bridgeLastSeenAt: integration?.bridgeLastSeenAt?.toISOString() ?? null,
    lastError: integration?.lastError ?? null,
    roomLocks: roomLocks.map((l) => ({ roomId: l.roomId, lockId: l.lockId, lockLabel: l.lockLabel })),
    grants: grants.map((g) => ({
      id: g.id, reservationId: g.reservationId, roomName: byId.get(g.reservationId)?.room.name ?? "Room", guestName: byId.get(g.reservationId)?.guest.fullName ?? "Guest",
      passcode: g.passcode, status: g.status, endsAt: g.endsAt.toISOString(), error: g.error,
    })),
  };
}

/** Connect TTLock. The password is hashed (MD5, as TTLock requires) and only the encrypted hash is kept. */
export async function connectTtlock(slug: string, input: { clientId: string; clientSecret: string; username: string; password: string }): Promise<ActionResult<{ locks: { lockId: string; name: string; hasGateway: boolean }[] }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const clientId = input.clientId.trim(), clientSecret = input.clientSecret.trim(), username = input.username.trim();
  if (!clientId || !clientSecret || !username || !input.password) return { success: false, error: "Fill in the developer ID, secret, TTLock username and password." };
  try {
    const passwordMd5 = /^[a-f0-9]{32}$/.test(input.password) ? input.password : md5(input.password);
    const token = await getToken({ clientId, clientSecret, username, passwordMd5 });
    const locks = await listLocks({ clientId, accessToken: token.accessToken });
    const data = {
      provider: "TTLOCK" as const, ttClientId: clientId, ttClientSecretEnc: encryptSecret(clientSecret), ttUsername: username, ttPasswordMd5Enc: encryptSecret(passwordMd5),
      ttTokenEnc: encryptSecret(token.accessToken), ttTokenExpiresAt: new Date(Date.now() + token.expiresInSec * 1000), lastError: null, bridgeToken: null, seamApiKeyEnc: null, seamSystemId: null,
    };
    await prisma.lockIntegration.upsert({ where: { storeId: a.store.id }, create: { storeId: a.store.id, ...data }, update: data });
    revalidatePath(`/store/${slug}/admin/pms`);
    return { success: true, data: { locks: locks.map((l) => ({ lockId: l.lockId, name: l.name, hasGateway: l.hasGateway })) } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not connect to TTLock." };
  }
}

export async function listTtlockLocks(slug: string): Promise<ActionResult<{ locks: { lockId: string; name: string; hasGateway: boolean }[] }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  try {
    const session = await getTtlockSession(a.store.id);
    if (!session) return { success: false, error: "Connect TTLock first." };
    const locks = await listLocks(session);
    return { success: true, data: { locks: locks.map((l) => ({ lockId: l.lockId, name: l.name, hasGateway: l.hasGateway })) } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not read locks." };
  }
}

/** Use an on-site agent (e.g. for ASSA ABLOY Visionline) instead of a cloud lock system. */
export async function enableBridge(slug: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const bridgeToken = crypto.randomBytes(20).toString("hex");
  const data = { provider: "BRIDGE" as const, bridgeToken, lastError: null, ttClientId: null, ttClientSecretEnc: null, ttUsername: null, ttPasswordMd5Enc: null, ttTokenEnc: null, ttTokenExpiresAt: null, seamApiKeyEnc: null, seamSystemId: null };
  await prisma.lockIntegration.upsert({ where: { storeId: a.store.id }, create: { storeId: a.store.id, ...data }, update: data });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

export async function disconnectLockSystem(slug: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  await prisma.lockIntegration.deleteMany({ where: { storeId: a.store.id } });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

export async function mapRoomLock(slug: string, roomId: string, lockId: string, lockLabel?: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const room = await prisma.propertyRoom.findFirst({ where: { id: roomId, storeId: a.store.id }, select: { id: true } });
  if (!room) return { success: false, error: "Room not found." };
  const id = lockId.trim().slice(0, 100);
  if (!id) { await prisma.roomLock.deleteMany({ where: { roomId } }); }
  else await prisma.roomLock.upsert({ where: { roomId }, create: { storeId: a.store.id, roomId, lockId: id, lockLabel: lockLabel?.slice(0, 80) || null }, update: { lockId: id, lockLabel: lockLabel?.slice(0, 80) || null } });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

/** Staff retry after a failed grant. */
export async function retryStayAccess(slug: string, reservationId: string): Promise<ActionResult<{ status: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const r = await prisma.propertyReservation.findFirst({ where: { id: reservationId, storeId: a.store.id }, select: { id: true, status: true } });
  if (!r) return { success: false, error: "Reservation not found." };
  if (r.status !== "CHECKED_IN") return { success: false, error: "Only checked-in guests can get door access." };
  await prisma.stayAccessGrant.updateMany({ where: { reservationId, status: "FAILED" }, data: { status: "REVOKED" } });
  const res = await issueStayAccess(reservationId);
  revalidatePath(`/store/${slug}/admin/pms`);
  if (res.status === "failed") return { success: false, error: res.error || "Could not issue access." };
  return { success: true, data: { status: res.status } };
}

export async function retryRevokeAccess(slug: string, reservationId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const r = await prisma.propertyReservation.findFirst({ where: { id: reservationId, storeId: a.store.id }, select: { id: true } });
  if (!r) return { success: false, error: "Reservation not found." };
  const res = await revokeStayAccess(reservationId);
  revalidatePath(`/store/${slug}/admin/pms`);
  return res.failed > 0 ? { success: false, error: "The lock system did not accept the removal. Try again." } : { success: true, data: undefined };
}


/** Salto KS (or Visionline) through Seam: check the key, then let the owner pick the access system. */
export async function connectSeam(slug: string, apiKey: string): Promise<ActionResult<{ systems: { id: string; name: string; type: string | null }[] }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const key = apiKey.trim();
  if (!key) return { success: false, error: "Paste the Seam API key." };
  try {
    const systems = await listAcsSystems(key);
    if (systems.length === 0) return { success: false, error: "That Seam workspace has no access system yet. Connect the Salto KS account in Seam first." };
    const data = {
      provider: "SEAM" as const, seamApiKeyEnc: encryptSecret(key), seamSystemId: systems.length === 1 ? systems[0].id : null, lastError: null, bridgeToken: null,
      ttClientId: null, ttClientSecretEnc: null, ttUsername: null, ttPasswordMd5Enc: null, ttTokenEnc: null, ttTokenExpiresAt: null,
    };
    await prisma.lockIntegration.upsert({ where: { storeId: a.store.id }, create: { storeId: a.store.id, ...data }, update: data });
    revalidatePath(`/store/${slug}/admin/pms`);
    return { success: true, data: { systems } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not reach Seam." };
  }
}

export async function selectSeamSystem(slug: string, systemId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.lockIntegration.updateMany({ where: { storeId: a.store.id, provider: "SEAM" }, data: { seamSystemId: systemId || null } });
  if (res.count === 0) return { success: false, error: "Connect the lock system first." };
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

/** The Salto access groups the owner can attach to rooms (one group per room, containing that room's door). */
export async function listSeamAccessGroups(slug: string): Promise<ActionResult<{ groups: { id: string; name: string }[] }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const i = await prisma.lockIntegration.findUnique({ where: { storeId: a.store.id } });
  if (!i || i.provider !== "SEAM" || !i.seamApiKeyEnc || !i.seamSystemId) return { success: false, error: "Choose the access system first." };
  try {
    return { success: true, data: { groups: await listAccessGroups(decryptSecret(i.seamApiKeyEnc), i.seamSystemId) } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not read access groups." };
  }
}

export async function listSeamSystems(slug: string): Promise<ActionResult<{ systems: { id: string; name: string; type: string | null }[] }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const i = await prisma.lockIntegration.findUnique({ where: { storeId: a.store.id } });
  if (!i || i.provider !== "SEAM" || !i.seamApiKeyEnc) return { success: false, error: "Connect the lock system first." };
  try {
    return { success: true, data: { systems: await listAcsSystems(decryptSecret(i.seamApiKeyEnc)) } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not reach Seam." };
  }
}
