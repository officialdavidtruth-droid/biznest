"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStoreCustomerByStoreId } from "@/lib/actions/store-customer";
import { checkRateLimit } from "@/lib/rate-limit";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

type WeeklyAvailability = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

async function assertStoreAccess(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false as const, error: "Store not found." };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false as const, error: "You don't have access to this store." };

  return { success: true as const, store };
}

/**
 * Available start times for a service on a given date, in the store's
 * server-local time (see README note on timezones — this is the known
 * simplification for v1). Existing bookings that day are subtracted out.
 */
export async function getAvailableSlots(serviceId: string, dateISO: string): Promise<string[]> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isBookable || !service.durationMins) return [];

  const availability = (service.availability as WeeklyAvailability | null) ?? null;
  if (!availability) return [];

  const date = new Date(`${dateISO}T00:00:00`);
  const dayKey = DAY_KEYS[date.getDay()];
  const windows = availability[dayKey];
  if (!windows || windows.length === 0) return [];

  const duration = service.durationMins;
  const slots: string[] = [];
  for (const [start, end] of windows) {
    let [h, m] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const endMinutes = endH * 60 + endM;
    while (h * 60 + m + duration <= endMinutes) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      m += duration;
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
    }
  }

  const dayStart = new Date(`${dateISO}T00:00:00`);
  const dayEnd = new Date(`${dateISO}T23:59:59`);
  const existing = await prisma.booking.findMany({
    where: { serviceId, scheduledAt: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
    select: { scheduledAt: true },
  });
  const taken = new Set(existing.map((b) => {
    const d = b.scheduledAt;
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }));

  // Don't offer slots already in the past for today.
  const now = new Date();
  const isToday = dayStart.toDateString() === now.toDateString();

  return slots.filter((s) => {
    if (taken.has(s)) return false;
    if (!isToday) return true;
    const [sh, sm] = s.split(":").map(Number);
    return sh * 60 + sm > now.getHours() * 60 + now.getMinutes();
  });
}

/** Customer books a slot. Requires sign-in, matching the Order flow. */
export async function createBooking(
  storeSlug: string,
  serviceId: string,
  dateISO: string,
  time: string,
  notes: string
): Promise<ActionResult<{ bookingId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in to book." };

  // 10 attempts / 5 minutes per user — a real customer never needs more
  // than a handful of tries; this is a backstop against calendar-spamming.
  const rate = await checkRateLimit(`booking:${session.user.id}`, 10, 5 * 60 * 1000);
  if (!rate.allowed) {
    return { success: false, error: "Too many booking attempts — please wait a few minutes and try again." };
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isBookable || !service.durationMins) {
    return { success: false, error: "This service isn't bookable." };
  }

  if (session.user.role === "CUSTOMER") {
    const membership = await requireStoreCustomerByStoreId(service.storeId);
    if (!membership) return { success: false, error: "This customer account belongs to another store. Sign up for this store to continue." };
  }

  const available = await getAvailableSlots(serviceId, dateISO);
  if (!available.includes(time)) {
    return { success: false, error: "That slot was just taken — pick another time." };
  }

  const [h, m] = time.split(":").map(Number);
  const scheduledAt = new Date(`${dateISO}T00:00:00`);
  scheduledAt.setHours(h, m, 0, 0);

  const booking = await prisma.booking.create({
    data: {
      storeId: service.storeId,
      serviceId,
      buyerId: session.user.id,
      scheduledAt,
      durationMins: service.durationMins,
      notes: notes || null,
    },
  });

  await emitWebhookEvent("BOOKING_CREATED", service.storeId, {
    bookingId: booking.id,
    serviceId,
    scheduledAt: booking.scheduledAt,
    durationMins: booking.durationMins,
  });

  revalidatePath(`/store/${storeSlug}`);
  return { success: true, data: { bookingId: booking.id } };
}

export async function listBookings(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.booking.findMany({
    where: { storeId: access.store.id },
    include: { service: true, buyer: { select: { name: true, email: true } } },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function updateBookingStatus(slug: string, bookingId: string, status: "CONFIRMED" | "COMPLETED" | "CANCELLED"): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, storeId: access.store.id } });
  if (!booking) return { success: false, error: "Booking not found." };

  await prisma.booking.update({ where: { id: bookingId }, data: { status } });

  if (status === "CONFIRMED") {
    await emitWebhookEvent("BOOKING_CONFIRMED", access.store.id, { bookingId, status });
  } else if (status === "CANCELLED") {
    await emitWebhookEvent("BOOKING_CANCELLED", access.store.id, { bookingId, status });
  }

  revalidatePath(`/store/${slug}/admin/services`);
  return { success: true, data: undefined };
}
