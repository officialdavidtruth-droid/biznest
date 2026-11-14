"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { APP_URL } from "@/lib/constants/app-url";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";

export type DoorReaderView = {
  id: string;
  name: string;
  roomId: string | null;
  roomName: string | null;
  isActive: boolean;
  url: string;
  lastSeenAt: string | null;
  scans: Array<{ id: string; cardUid: string; allowed: boolean; reason: string; at: string }>;
};

async function access(slug: string) {
  return assertStorePermission(slug, "plugin:pms");
}

export async function getDoorReaders(slug: string): Promise<DoorReaderView[]> {
  const a = await access(slug);
  if (!a.success) return [];
  const readers = await prisma.doorReader.findMany({
    where: { storeId: a.store.id },
    include: { room: { select: { name: true } }, scans: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return readers.map((r) => ({
    id: r.id,
    name: r.name,
    roomId: r.roomId,
    roomName: r.room?.name ?? null,
    isActive: r.isActive,
    url: `${APP_URL}/api/pms/door/${r.token}`,
    lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    scans: r.scans.map((s) => ({ id: s.id, cardUid: s.cardUid, allowed: s.allowed, reason: s.reason, at: s.createdAt.toISOString() })),
  }));
}

export async function createDoorReader(slug: string, input: { name: string; roomId?: string }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { success: false, error: "Give the door reader a name." };
  if (input.roomId) {
    const room = await prisma.propertyRoom.findFirst({ where: { id: input.roomId, storeId: a.store.id }, select: { id: true } });
    if (!room) return { success: false, error: "Room not found." };
  }
  if ((await prisma.doorReader.count({ where: { storeId: a.store.id } })) >= 100) return { success: false, error: "Door reader limit reached." };
  const row = await prisma.doorReader.create({
    data: { storeId: a.store.id, roomId: input.roomId || null, name, token: crypto.randomBytes(20).toString("hex") },
    select: { id: true },
  });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: { id: row.id } };
}

/** Replace the secret URL (use after a controller is lost or its URL leaks). */
export async function rotateDoorReader(slug: string, id: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.doorReader.updateMany({ where: { id, storeId: a.store.id }, data: { token: crypto.randomBytes(20).toString("hex") } });
  if (res.count === 0) return { success: false, error: "Door reader not found." };
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}

export async function deleteDoorReader(slug: string, id: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  await prisma.doorReader.deleteMany({ where: { id, storeId: a.store.id } });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}
