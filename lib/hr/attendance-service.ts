import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_TZ, classifyArrival, dayBounds, foldDay, parseDeviceTime, workDateFor, type RawScan,
} from "@/lib/hr/attendance-core";

export type PunchSource = "SELF" | "WEBAUTHN" | "DEVICE" | "IMPORT" | "MANUAL";

export type PunchInput = {
  at: Date;
  source: PunchSource;
  employeeId?: string | null;
  deviceUserId?: string | null;
  deviceId?: string | null;
  direction?: string | null;
};

export async function storeTimeZone(storeId: string): Promise<string> {
  const s = await prisma.store.findUnique({ where: { id: storeId }, select: { timezone: true } });
  return s?.timezone || DEFAULT_TZ;
}

export async function getHrSettings(storeId: string) {
  const s = await prisma.hrSettings.findUnique({ where: { storeId } });
  return { shiftStart: s?.shiftStart ?? "09:00", graceMinutes: s?.graceMinutes ?? 15, requireBiometric: s?.requireBiometric ?? false };
}

/**
 * Rebuilds one person's attendance row for one day from every scan recorded for that day.
 * Idempotent: running it twice gives the same row, so re-sent or re-imported scans are harmless.
 */
export async function recomputeAttendanceDay(storeId: string, employeeId: string, workDate: Date, timeZone: string) {
  const { start, end } = dayBounds(workDate, timeZone);
  const punches = await prisma.hrPunch.findMany({
    where: { storeId, employeeId, punchedAt: { gte: start, lt: end } },
    select: { punchedAt: true, source: true },
  });
  const folded = foldDay<{ at: Date; source: string }>(punches.map((p: { punchedAt: Date; source: string }) => ({ at: p.punchedAt, source: p.source })));
  if (!folded) return;
  const settings = await getHrSettings(storeId);
  const existing = await prisma.hrAttendance.findUnique({ where: { employeeId_workDate: { employeeId, workDate } } });
  // An admin's explicit HALF_DAY / ON_LEAVE call outranks the clock-based status.
  const keep = existing && (existing.status === "HALF_DAY" || existing.status === "ON_LEAVE");
  const status = keep ? existing!.status : classifyArrival(folded.first.at, timeZone, settings.shiftStart, settings.graceMinutes);
  const data = {
    status,
    checkIn: folded.first.at,
    checkOut: folded.last ? folded.last.at : null,
    checkInSource: folded.first.source,
    checkOutSource: folded.last ? folded.last.source : null,
  };
  await prisma.hrAttendance.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    create: { storeId, employeeId, workDate, ...data },
    update: data,
  });
}

/** Stores scans, links them to employees, and refreshes the affected attendance days. */
export async function recordPunches(storeId: string, inputs: PunchInput[]) {
  if (!inputs.length) return { stored: 0, unmatched: 0, days: 0 };
  const tz = await storeTimeZone(storeId);
  const ids = Array.from(new Set(inputs.map((i) => i.deviceUserId).filter((x): x is string => !!x)));
  const mapped = ids.length
    ? await prisma.hrEmployee.findMany({ where: { storeId, deviceUserId: { in: ids }, status: { not: "EXITED" } }, select: { id: true, deviceUserId: true } })
    : [];
  const byUser = new Map<string, string>(mapped.map((e: { id: string; deviceUserId: string | null }) => [e.deviceUserId!, e.id] as [string, string]));

  const rows = inputs.map((i) => ({
    storeId,
    deviceId: i.deviceId ?? null,
    employeeId: i.employeeId ?? (i.deviceUserId ? byUser.get(i.deviceUserId) ?? null : null),
    deviceUserId: i.deviceUserId ?? null,
    punchedAt: i.at,
    source: i.source,
    direction: i.direction ?? null,
  }));
  const created = await prisma.hrPunch.createMany({ data: rows, skipDuplicates: true });

  const touched = new Map<string, { employeeId: string; workDate: Date }>();
  for (const r of rows) {
    if (!r.employeeId) continue;
    const wd = workDateFor(r.punchedAt, tz);
    touched.set(`${r.employeeId}|${wd.toISOString()}`, { employeeId: r.employeeId, workDate: wd });
  }
  for (const t of touched.values()) await recomputeAttendanceDay(storeId, t.employeeId, t.workDate, tz);
  return { stored: created.count, unmatched: rows.filter((r) => !r.employeeId).length, days: touched.size };
}

/** After an employee is given a scanner ID, attach scans that arrived earlier under that ID. */
export async function rematchPunches(storeId: string, employeeId: string, deviceUserId: string) {
  const orphans = await prisma.hrPunch.findMany({ where: { storeId, deviceUserId, employeeId: null }, select: { id: true, punchedAt: true } });
  if (!orphans.length) return 0;
  await prisma.hrPunch.updateMany({ where: { id: { in: orphans.map((o) => o.id) } }, data: { employeeId } });
  const tz = await storeTimeZone(storeId);
  const days = new Map<string, Date>(orphans.map((o: { punchedAt: Date }) => { const wd = workDateFor(o.punchedAt, tz); return [wd.toISOString(), wd] as [string, Date]; }));
  for (const wd of days.values()) await recomputeAttendanceDay(storeId, employeeId, wd, tz);
  return orphans.length;
}

/** Turns raw scanner lines into punch inputs using the device's clock offset. */
export function scansToPunches(scans: RawScan[], device: { id: string; tzOffsetMinutes: number }, source: PunchSource = "DEVICE") {
  const punches: PunchInput[] = [];
  let skipped = 0;
  for (const s of scans) {
    const at = parseDeviceTime(s.time, device.tzOffsetMinutes);
    // Ignore timestamps in the future (a scanner with a wrong clock would otherwise poison "today").
    if (!at || at.getTime() > Date.now() + 10 * 60000) { skipped++; continue; }
    punches.push({ at, source, deviceUserId: s.userId, deviceId: device.id, direction: s.state });
  }
  return { punches, skipped };
}

// ---- device keys ----

export function newDeviceKey() {
  return `hrk_${randomBytes(24).toString("hex")}`;
}
export const hashDeviceKey = (key: string) => createHash("sha256").update(key).digest("hex");

export function deviceKeyMatches(key: string, hash: string): boolean {
  const a = Buffer.from(hashDeviceKey(key), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Registered scanner by serial number; also stamps lastSeenAt so the dashboard can show it is online. */
export async function touchDeviceBySerial(serial: string) {
  const device = await prisma.hrBiometricDevice.findUnique({ where: { serialNumber: serial } });
  if (!device) return null;
  await prisma.hrBiometricDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return device;
}
