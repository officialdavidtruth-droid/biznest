"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { addLocalDays, getLocalDateKey, localDateEndUtc, localDateStartUtc, zonedTimeToUtc } from "@/lib/timezone";
import { overlaps, readReservationConfig, slotStarts, type ReservationConfig } from "@/lib/table-reservations";
import type { ActionResult } from "@/types/actions";

const ACTIVE = ["CONFIRMED", "SEATED"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function loadStore(slug: string) {
  return prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, timezone: true, storefrontConfig: true, businessType: true, status: true } });
}

/** Tables free for [start,end) that seat `party`, smallest first. */
async function freeTables(storeId: string, party: number, start: Date, end: Date, db: Pick<typeof prisma, "fnbTable" | "tableReservation"> = prisma) {
  const tables = await db.fnbTable.findMany({ where: { storeId, active: true }, orderBy: [{ seats: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, seats: true } });
  const fit = tables.filter((t) => t.seats == null || t.seats >= party);
  if (!fit.length) return [];
  const busy = await db.tableReservation.findMany({ where: { storeId, tableId: { in: fit.map((t) => t.id) }, status: { in: ACTIVE }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { tableId: true } });
  const taken = new Set(busy.map((b) => b.tableId));
  return fit.filter((t) => !taken.has(t.id));
}

export async function getReserveInfo(slug: string): Promise<{ name: string; open: boolean; cfg: ReservationConfig; today: string; maxDate: string } | null> {
  const store = await loadStore(slug);
  if (!store) return null;
  const cfg = readReservationConfig(store.storefrontConfig);
  const tableCount = await prisma.fnbTable.count({ where: { storeId: store.id, active: true } });
  const today = getLocalDateKey(new Date(), store.timezone);
  return { name: store.name, open: cfg.enabled && tableCount > 0, cfg, today, maxDate: addLocalDays(today, cfg.daysAhead) };
}

export async function getReservationSlots(slug: string, dateISO: string, party: number): Promise<ActionResult<{ slots: { time: string; available: boolean }[] }>> {
  if (!DATE_RE.test(dateISO) || !Number.isInteger(party) || party < 1) return { success: false, error: "Choose a date and party size." };
  const store = await loadStore(slug);
  if (!store) return { success: false, error: "Restaurant not found." };
  const cfg = readReservationConfig(store.storefrontConfig);
  if (!cfg.enabled) return { success: false, error: "Online reservations are not available right now." };
  if (party > cfg.maxParty) return { success: false, error: `For parties over ${cfg.maxParty}, please contact the restaurant directly.` };
  const today = getLocalDateKey(new Date(), store.timezone);
  if (dateISO < today || dateISO > addLocalDays(today, cfg.daysAhead)) return { success: false, error: "That date is outside the booking window." };
  const earliest = Date.now() + cfg.leadMins * 60_000;
  const slots: { time: string; available: boolean }[] = [];
  for (const time of slotStarts(cfg)) {
    const start = zonedTimeToUtc(dateISO, time, store.timezone);
    if (start.getTime() < earliest) continue;
    const end = new Date(start.getTime() + cfg.durationMins * 60_000);
    slots.push({ time, available: (await freeTables(store.id, party, start, end)).length > 0 });
  }
  return { success: true, data: { slots } };
}

export async function createTableReservation(slug: string, input: { date: string; time: string; partySize: number; guestName: string; phone: string; email?: string; notes?: string }): Promise<ActionResult<{ code: string; tableName: string | null; startsAt: Date }>> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(`tres:${slug}:${ip}`, 8, 60 * 60 * 1000);
  if (!rl.allowed) return { success: false, error: "Too many reservation attempts. Please try again later." };
  const store = await loadStore(slug);
  if (!store) return { success: false, error: "Restaurant not found." };
  const cfg = readReservationConfig(store.storefrontConfig);
  if (!cfg.enabled) return { success: false, error: "Online reservations are not available right now." };
  const guestName = input.guestName.trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = input.phone.trim().slice(0, 30);
  const email = input.email?.trim().slice(0, 120) || null;
  if (guestName.length < 2) return { success: false, error: "Enter your name." };
  if (phone.replace(/\D/g, "").length < 7) return { success: false, error: "Enter a phone number we can reach you on." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: "That email doesn't look right." };
  if (!DATE_RE.test(input.date) || !slotStarts(cfg).includes(input.time)) return { success: false, error: "Choose one of the available times." };
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > cfg.maxParty) return { success: false, error: `Party size must be between 1 and ${cfg.maxParty}.` };
  const today = getLocalDateKey(new Date(), store.timezone);
  if (input.date < today || input.date > addLocalDays(today, cfg.daysAhead)) return { success: false, error: "That date is outside the booking window." };
  const start = zonedTimeToUtc(input.date, input.time, store.timezone);
  if (start.getTime() < Date.now() + cfg.leadMins * 60_000) return { success: false, error: "That time is too soon. Pick a later one." };
  const end = new Date(start.getTime() + cfg.durationMins * 60_000);
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  try {
    const made = await prisma.$transaction(async (tx) => {
      const free = await freeTables(store.id, input.partySize, start, end, tx);
      if (!free.length) return null;
      const table = free[0];
      await tx.tableReservation.create({ data: { storeId: store.id, tableId: table.id, code, guestName, phone, email, partySize: input.partySize, startsAt: start, endsAt: end, notes: input.notes?.trim().slice(0, 300) || null } });
      return table;
    }, { isolationLevel: "Serializable" });
    if (!made) return { success: false, error: "Sorry, that time was just taken. Please pick another." };
    revalidatePath(`/store/${slug}/admin/tables`);
    return { success: true, data: { code, tableName: made.name, startsAt: start } };
  } catch (e: any) {
    if (e?.code === "P2034") return { success: false, error: "That time was just taken. Please try again." };
    throw e;
  }
}

/* ───────────── Admin ───────────── */
async function adminGuard(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { ok: false as const, error: a.error };
  return { ok: true as const, storeId: a.store.id };
}

export async function getReservationsAdmin(slug: string, dateISO?: string): Promise<ActionResult<{ date: string; cfg: ReservationConfig; reservations: { id: string; code: string; guestName: string; phone: string; partySize: number; startsAt: Date; endsAt: Date; status: string; notes: string | null; tableName: string | null }[] }>> {
  const g = await adminGuard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const store = await loadStore(slug);
  if (!store) return { success: false, error: "Store not found." };
  const date = dateISO && DATE_RE.test(dateISO) ? dateISO : getLocalDateKey(new Date(), store.timezone);
  const rows = await prisma.tableReservation.findMany({ where: { storeId: g.storeId, startsAt: { gte: localDateStartUtc(date, store.timezone), lt: localDateEndUtc(date, store.timezone) } }, orderBy: { startsAt: "asc" }, include: { table: { select: { name: true } } } });
  return { success: true, data: { date, cfg: readReservationConfig(store.storefrontConfig), reservations: rows.map((r) => ({ id: r.id, code: r.code, guestName: r.guestName, phone: r.phone, partySize: r.partySize, startsAt: r.startsAt, endsAt: r.endsAt, status: r.status, notes: r.notes, tableName: r.table?.name ?? null })) } };
}

export async function setReservationStatus(slug: string, id: string, status: "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"): Promise<ActionResult<undefined>> {
  const g = await adminGuard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const res = await prisma.tableReservation.updateMany({ where: { id, storeId: g.storeId }, data: { status } });
  if (!res.count) return { success: false, error: "Reservation not found." };
  revalidatePath(`/store/${slug}/admin/tables`);
  return { success: true, data: undefined };
}

export async function saveReservationSettings(slug: string, cfg: ReservationConfig): Promise<ActionResult<undefined>> {
  const g = await adminGuard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const clean = readReservationConfig({ tableReservations: cfg });
  if (clean.open >= clean.close) return { success: false, error: "Closing time must be after opening time." };
  if (slotStarts(clean).length === 0) return { success: false, error: "The sitting length doesn't fit between opening and closing." };
  const store = await prisma.store.findUnique({ where: { id: g.storeId }, select: { storefrontConfig: true } });
  const base = store?.storefrontConfig && typeof store.storefrontConfig === "object" ? (store.storefrontConfig as Record<string, unknown>) : {};
  await prisma.store.update({ where: { id: g.storeId }, data: { storefrontConfig: { ...base, tableReservations: clean } as any } });
  revalidatePath(`/store/${slug}/admin/tables`);
  return { success: true, data: undefined };
}
