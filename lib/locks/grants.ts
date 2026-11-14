/**
 * Guest door access that follows the stay: issued at check-in, removed at check-out or cancellation.
 * Nothing here ever throws into the front-desk action: a lock problem is stored on the grant
 * (status FAILED + reason) so staff can see it and retry, but check-in always goes through.
 */
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/payments/store-gateway";
import { addPasscode, deletePasscode, generatePasscode, getToken } from "@/lib/locks/ttlock";
import { createGuestPin, deleteGuest } from "@/lib/locks/seam";
import { logError, errorMeta } from "@/lib/observability/log";

const TOKEN_SKEW_MS = 10 * 60_000;

async function ttToken(integrationId: string): Promise<{ clientId: string; accessToken: string }> {
  const i = await prisma.lockIntegration.findUniqueOrThrow({ where: { id: integrationId } });
  if (!i.ttClientId || !i.ttClientSecretEnc || !i.ttUsername || !i.ttPasswordMd5Enc) throw new Error("TTLock details are incomplete.");
  if (i.ttTokenEnc && i.ttTokenExpiresAt && i.ttTokenExpiresAt.getTime() - Date.now() > TOKEN_SKEW_MS) {
    return { clientId: i.ttClientId, accessToken: decryptSecret(i.ttTokenEnc) };
  }
  const t = await getToken({ clientId: i.ttClientId, clientSecret: decryptSecret(i.ttClientSecretEnc), username: i.ttUsername, passwordMd5: decryptSecret(i.ttPasswordMd5Enc) });
  await prisma.lockIntegration.update({ where: { id: i.id }, data: { ttTokenEnc: encryptSecret(t.accessToken), ttTokenExpiresAt: new Date(Date.now() + t.expiresInSec * 1000), lastError: null } });
  return { clientId: i.ttClientId, accessToken: t.accessToken };
}

export async function getTtlockSession(storeId: string) {
  const i = await prisma.lockIntegration.findUnique({ where: { storeId }, select: { id: true, provider: true } });
  if (!i || i.provider !== "TTLOCK") return null;
  return ttToken(i.id);
}

/** Create the guest's door access for a checked-in reservation. Safe to call twice. */
export async function issueStayAccess(reservationId: string): Promise<{ status: "none" | "active" | "pending" | "failed"; error?: string }> {
  try {
    const r = await prisma.propertyReservation.findUnique({ where: { id: reservationId }, include: { guest: { select: { fullName: true } }, room: { select: { name: true } } } });
    if (!r) return { status: "none" };
    const integration = await prisma.lockIntegration.findUnique({ where: { storeId: r.storeId } });
    if (!integration) return { status: "none" };
    const lock = await prisma.roomLock.findUnique({ where: { roomId: r.roomId } });
    if (!lock) return { status: "none" };
    if (await prisma.stayAccessGrant.findFirst({ where: { reservationId, status: { in: ["PENDING", "ACTIVE"] } }, select: { id: true } })) return { status: "active" };

    const startsAt = new Date();
    const endsAt = r.checkOut > startsAt ? r.checkOut : new Date(startsAt.getTime() + 3_600_000);
    const base = { storeId: r.storeId, reservationId, roomId: r.roomId, provider: integration.provider, lockId: lock.lockId, startsAt, endsAt };

    if (integration.provider === "BRIDGE") {
      await prisma.stayAccessGrant.create({ data: { ...base, status: "PENDING" } });
      return { status: "pending" };
    }

    if (integration.provider === "SEAM") {
      if (!integration.seamApiKeyEnc || !integration.seamSystemId) return { status: "failed", error: "Finish connecting the lock system first." };
      const grant = await prisma.stayAccessGrant.create({ data: { ...base, status: "PENDING" } });
      try {
        const pin = await createGuestPin({ apiKey: decryptSecret(integration.seamApiKeyEnc), systemId: integration.seamSystemId, accessGroupId: lock.lockId, fullName: `${r.guest.fullName} (${r.room.name})`, startsAt, endsAt });
        await prisma.stayAccessGrant.update({ where: { id: grant.id }, data: { status: "ACTIVE", externalId: pin.acsUserId, passcode: pin.code, error: null } });
        return { status: "active" };
      } catch (err) {
        const error = err instanceof Error ? err.message.slice(0, 200) : "Could not reach the lock system.";
        await prisma.stayAccessGrant.update({ where: { id: grant.id }, data: { status: "FAILED", error } });
        await prisma.lockIntegration.update({ where: { id: integration.id }, data: { lastError: error } }).catch(() => undefined);
        return { status: "failed", error };
      }
    }

    const passcode = generatePasscode();
    const grant = await prisma.stayAccessGrant.create({ data: { ...base, passcode, status: "PENDING" } });
    try {
      const session = await ttToken(integration.id);
      const externalId = await addPasscode({ ...session, lockId: lock.lockId, passcode, name: `${r.room.name} ${r.guest.fullName}`, startMs: startsAt.getTime(), endMs: endsAt.getTime() });
      await prisma.stayAccessGrant.update({ where: { id: grant.id }, data: { status: "ACTIVE", externalId, error: null } });
      return { status: "active" };
    } catch (err) {
      const error = err instanceof Error ? err.message.slice(0, 200) : "Could not reach the lock system.";
      await prisma.stayAccessGrant.update({ where: { id: grant.id }, data: { status: "FAILED", error } });
      await prisma.lockIntegration.update({ where: { id: integration.id }, data: { lastError: error } }).catch(() => undefined);
      return { status: "failed", error };
    }
  } catch (err) {
    void logError("JOBS", "Issuing stay access failed", errorMeta(err, { reservationId }));
    return { status: "failed", error: "Could not issue door access." };
  }
}

/** Remove the guest's door access (check-out, cancellation, room move). */
export async function revokeStayAccess(reservationId: string): Promise<{ revoked: number; failed: number }> {
  let revoked = 0;
  let failed = 0;
  try {
    const grants = await prisma.stayAccessGrant.findMany({ where: { reservationId, status: { in: ["PENDING", "ACTIVE", "FAILED", "REVOKE_PENDING"] } } });
    for (const g of grants) {
      try {
        if (g.provider === "BRIDGE") {
          if (g.status === "PENDING" || g.status === "FAILED") { await prisma.stayAccessGrant.update({ where: { id: g.id }, data: { status: "REVOKED" } }); }
          else await prisma.stayAccessGrant.update({ where: { id: g.id }, data: { status: "REVOKE_PENDING" } });
          revoked++;
          continue;
        }
        if (g.provider === "SEAM") {
          if (g.externalId) {
            const integ = await prisma.lockIntegration.findUnique({ where: { storeId: g.storeId }, select: { seamApiKeyEnc: true } });
            if (!integ?.seamApiKeyEnc) throw new Error("The lock system is no longer connected.");
            await deleteGuest(decryptSecret(integ.seamApiKeyEnc), g.externalId);
          }
          await prisma.stayAccessGrant.update({ where: { id: g.id }, data: { status: "REVOKED", error: null } });
          revoked++;
          continue;
        }
        if (g.externalId) {
          const session = await getTtlockSession(g.storeId);
          if (!session) throw new Error("TTLock is no longer connected.");
          await deletePasscode({ ...session, lockId: g.lockId, passcodeId: g.externalId });
        }
        await prisma.stayAccessGrant.update({ where: { id: g.id }, data: { status: "REVOKED", error: null } });
        revoked++;
      } catch (err) {
        failed++;
        await prisma.stayAccessGrant.update({ where: { id: g.id }, data: { status: "REVOKE_PENDING", error: err instanceof Error ? err.message.slice(0, 200) : "Could not remove access." } }).catch(() => undefined);
      }
    }
  } catch (err) {
    void logError("JOBS", "Revoking stay access failed", errorMeta(err, { reservationId }));
  }
  return { revoked, failed };
}
