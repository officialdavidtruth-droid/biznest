"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { emailDeliveryUpdate } from "@/lib/dispatch-notify";
import { pinMatches } from "@/lib/dispatch";
import { riderPath, trackPath } from "@/lib/dispatch";
import type { ActionResult } from "@/types/actions";

// Public (no sign-in) entry points for riders, authorised by the rider's unguessable link. A rider can only touch jobs
// assigned to them in their own store, and a delivery is only completed with the customer's PIN.

async function callerIp() {
  try { return getClientIp(await headers()); } catch { return "unknown"; }
}
const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(t);

async function riderFor(slug: string, token: string) {
  if (!validToken(token)) return null;
  const rider = await prisma.rider.findUnique({ where: { accessToken: token }, include: { store: { select: { id: true, slug: true, status: true } } } });
  if (!rider || !rider.active || rider.store.slug !== slug || rider.store.status !== "ACTIVE") return null;
  return rider;
}
async function limited(token: string, kind: string, max: number) {
  const ip = await callerIp();
  const [a, b] = await Promise.all([checkRateLimit(`rider-${kind}:ip:${ip}`, max * 3, 60 * 60 * 1000), checkRateLimit(`rider-${kind}:tok:${token}`, max, 60 * 60 * 1000)]);
  return !a.allowed || !b.allowed;
}
const done = (slug: string, token: string, trackToken: string) => {
  revalidatePath(riderPath(slug, token)); revalidatePath(trackPath(slug, trackToken)); revalidatePath(`/store/${slug}/admin/dispatch`);
};

export async function riderPickedUp(slug: string, token: string, deliveryId: string): Promise<ActionResult> {
  if (await limited(token, "act", 120)) return { success: false, error: "Too many attempts. Try again shortly." };
  const rider = await riderFor(slug, token);
  if (!rider) return { success: false, error: "This link isn't valid." };
  const d = await prisma.delivery.findFirst({ where: { id: deliveryId, riderId: rider.id, storeId: rider.storeId } });
  if (!d) return { success: false, error: "Job not found." };
  const res = await prisma.delivery.updateMany({ where: { id: d.id, riderId: rider.id, status: "ASSIGNED" }, data: { status: "PICKED_UP", pickedUpAt: new Date() } });
  if (res.count === 0) return { success: false, error: "This job can't be marked picked up now." };
  await prisma.deliveryEvent.create({ data: { deliveryId: d.id, status: "PICKED_UP", note: "Picked up" } });
  void emailDeliveryUpdate(d.id, "PICKED_UP");
  done(slug, token, d.trackToken);
  return { success: true, data: undefined };
}

/** Completes a delivery. The customer's 4-digit PIN is the proof; wrong guesses are rate limited per job. */
export async function riderDelivered(slug: string, token: string, deliveryId: string, input: { pin: string; recipientName?: string }): Promise<ActionResult> {
  if (await limited(token, "act", 120)) return { success: false, error: "Too many attempts. Try again shortly." };
  const rider = await riderFor(slug, token);
  if (!rider) return { success: false, error: "This link isn't valid." };
  const d = await prisma.delivery.findFirst({ where: { id: deliveryId, riderId: rider.id, storeId: rider.storeId } });
  if (!d) return { success: false, error: "Job not found." };
  if (d.status !== "PICKED_UP") return { success: false, error: "Mark the job as picked up first." };
  const guesses = await checkRateLimit(`rider-pin:${d.id}`, 6, 60 * 60 * 1000);
  if (!guesses.allowed) return { success: false, error: "Too many wrong codes. Ask the office to complete this delivery." };
  if (!pinMatches(d.deliveryPin, input.pin)) return { success: false, error: "That code isn't right. Ask the customer to check their tracking page." };
  const res = await prisma.delivery.updateMany({ where: { id: d.id, riderId: rider.id, status: "PICKED_UP" }, data: { status: "DELIVERED", deliveredAt: new Date(), recipientName: input.recipientName?.trim().slice(0, 120) || null } });
  if (res.count === 0) return { success: false, error: "This job was just updated." };
  await prisma.deliveryEvent.create({ data: { deliveryId: d.id, status: "DELIVERED", note: input.recipientName?.trim() ? `Received by ${input.recipientName.trim().slice(0, 120)}` : "Delivered" } });
  void emailDeliveryUpdate(d.id, "DELIVERED");
  done(slug, token, d.trackToken);
  return { success: true, data: undefined };
}

export async function riderFailed(slug: string, token: string, deliveryId: string, reason: string): Promise<ActionResult> {
  if (await limited(token, "act", 120)) return { success: false, error: "Too many attempts. Try again shortly." };
  const rider = await riderFor(slug, token);
  if (!rider) return { success: false, error: "This link isn't valid." };
  const why = String(reason ?? "").trim().slice(0, 200);
  if (!why) return { success: false, error: "Say why it couldn't be delivered." };
  const d = await prisma.delivery.findFirst({ where: { id: deliveryId, riderId: rider.id, storeId: rider.storeId } });
  if (!d) return { success: false, error: "Job not found." };
  const res = await prisma.delivery.updateMany({ where: { id: d.id, riderId: rider.id, status: { in: ["ASSIGNED", "PICKED_UP"] } }, data: { status: "FAILED", failureReason: why } });
  if (res.count === 0) return { success: false, error: "This job can't be marked failed now." };
  await prisma.deliveryEvent.create({ data: { deliveryId: d.id, status: "FAILED", note: why } });
  void emailDeliveryUpdate(d.id, "FAILED");
  done(slug, token, d.trackToken);
  return { success: true, data: undefined };
}
