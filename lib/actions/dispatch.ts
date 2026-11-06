"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { emailDeliveryUpdate } from "@/lib/dispatch-notify";
import { canMove, jobNumber, lastJobSeq, newDeliveryPin, newDispatchToken, sanitizeJob, type JobInput } from "@/lib/dispatch";
import type { ActionResult } from "@/types/actions";

// Dispatcher side of logistics. Every query is scoped to the caller's store.

const fail = (error: string): ActionResult<never> => ({ success: false, error });
const refresh = (slug: string) => revalidatePath(`/store/${slug}/admin/dispatch`);
const access = (slug: string) => assertStorePermission(slug, "products");

export async function createRider(slug: string, input: { name: string; phone?: string; vehicle?: string }): Promise<ActionResult<{ accessToken: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) return fail("Enter the rider's name.");
  const accessToken = newDispatchToken();
  await prisma.rider.create({ data: { storeId: a.store.id, name, phone: input.phone?.trim().slice(0, 20) || null, vehicle: input.vehicle?.trim().slice(0, 60) || null, accessToken } });
  refresh(slug);
  return { success: true, data: { accessToken } };
}

export async function setRiderActive(slug: string, riderId: string, active: boolean): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  if (!active) {
    const busy = await prisma.delivery.count({ where: { riderId, storeId: a.store.id, status: { in: ["ASSIGNED", "PICKED_UP"] } } });
    if (busy > 0) return fail("This rider still has deliveries in progress.");
  }
  const res = await prisma.rider.updateMany({ where: { id: riderId, storeId: a.store.id }, data: { active } });
  if (res.count === 0) return fail("Rider not found.");
  refresh(slug);
  return { success: true, data: undefined };
}

/** Replaces the rider's secret link. The old link stops working at once. */
export async function regenerateRiderLink(slug: string, riderId: string): Promise<ActionResult<{ accessToken: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const accessToken = newDispatchToken();
  const res = await prisma.rider.updateMany({ where: { id: riderId, storeId: a.store.id }, data: { accessToken } });
  if (res.count === 0) return fail("Rider not found.");
  refresh(slug);
  return { success: true, data: { accessToken } };
}

export async function createDelivery(slug: string, input: JobInput & { riderId?: string }): Promise<ActionResult<{ jobNo: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const j = sanitizeJob(input); if (!j.ok) return fail(j.error);
  let riderId: string | null = null;
  if (input.riderId) {
    const r = await prisma.rider.findFirst({ where: { id: input.riderId, storeId: a.store.id, active: true }, select: { id: true } });
    if (!r) return fail("Rider not found.");
    riderId = r.id;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const latest = await prisma.delivery.findMany({ where: { storeId: a.store.id }, orderBy: { jobNo: "desc" }, take: 1, select: { jobNo: true } });
    const jobNo = jobNumber(lastJobSeq(latest.map((l) => l.jobNo)) + 1);
    try {
      const d = await prisma.delivery.create({
        data: {
          storeId: a.store.id, jobNo, ...j.job, riderId, status: riderId ? "ASSIGNED" : "NEW", assignedAt: riderId ? new Date() : null,
          trackToken: newDispatchToken(), deliveryPin: newDeliveryPin(),
          events: { create: [{ status: "NEW", note: "Booked" }, ...(riderId ? [{ status: "ASSIGNED", note: "Rider assigned" }] : [])] },
        },
        select: { id: true },
      });
      if (riderId) void emailDeliveryUpdate(d.id, "ASSIGNED");
      refresh(slug);
      return { success: true, data: { jobNo } };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue; // another job took that number
      throw err;
    }
  }
  return fail("Could not create the job. Please try again.");
}

export async function assignRider(slug: string, deliveryId: string, riderId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const rider = await prisma.rider.findFirst({ where: { id: riderId, storeId: a.store.id, active: true }, select: { id: true } });
  if (!rider) return fail("Rider not found.");
  const res = await prisma.delivery.updateMany({ where: { id: deliveryId, storeId: a.store.id, status: { in: ["NEW", "ASSIGNED"] } }, data: { riderId: rider.id, status: "ASSIGNED", assignedAt: new Date() } });
  if (res.count === 0) return fail("This job can't be reassigned now.");
  await prisma.deliveryEvent.create({ data: { deliveryId, status: "ASSIGNED", note: "Rider assigned" } });
  void emailDeliveryUpdate(deliveryId, "ASSIGNED");
  refresh(slug);
  return { success: true, data: undefined };
}

/** Staff moves: cancel, take back from a rider, or send a failed job out again. */
export async function setDeliveryStatus(slug: string, deliveryId: string, to: "NEW" | "CANCELLED", note?: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const d = await prisma.delivery.findFirst({ where: { id: deliveryId, storeId: a.store.id } });
  if (!d) return fail("Job not found.");
  if (!canMove(d.status, to)) return fail("That change isn't allowed from the job's current state.");
  const res = await prisma.delivery.updateMany({ where: { id: d.id, status: d.status }, data: { status: to, ...(to === "NEW" ? { riderId: null, failureReason: null } : {}) } });
  if (res.count === 0) return fail("This job just changed. Refresh and try again.");
  await prisma.deliveryEvent.create({ data: { deliveryId: d.id, status: to, note: note?.trim().slice(0, 200) || (to === "NEW" ? "Returned to the queue" : "Cancelled") } });
  refresh(slug);
  return { success: true, data: undefined };
}

export async function markDeliveryFeePaid(slug: string, deliveryId: string, paid: boolean): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const res = await prisma.delivery.updateMany({ where: { id: deliveryId, storeId: a.store.id }, data: { feePaid: paid } });
  if (res.count === 0) return fail("Job not found.");
  refresh(slug);
  return { success: true, data: undefined };
}

/** The rider has handed in the cash for all their delivered cash-on-delivery jobs. */
export async function remitRiderCash(slug: string, riderId: string): Promise<ActionResult<{ jobs: number }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const res = await prisma.delivery.updateMany({ where: { storeId: a.store.id, riderId, status: "DELIVERED", codRemittedAt: null, codAmount: { gt: 0 } }, data: { codRemittedAt: new Date() } });
  if (res.count === 0) return fail("Nothing to remit for this rider.");
  refresh(slug);
  return { success: true, data: { jobs: res.count } };
}
