"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  return assertStorePermission(slug, "products");
}

/**
 * All unit-based services (totalUnits set) for this store, each with its
 * units and every booking that overlaps the given date window. Powers the
 * top-level Calendar page — one grid per service category, rows = units,
 * spanning bars = bookings.
 */
export async function getCalendarData(slug: string, rangeStart: string, rangeEnd: string) {
  const a = await access(slug);
  if (!a.success) return null;

  const start = new Date(`${rangeStart}T00:00:00`);
  const end = new Date(`${rangeEnd}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const services = await prisma.service.findMany({
    where: { storeId: a.store.id, totalUnits: { not: null } },
    orderBy: { name: "asc" },
    include: {
      units: {
        orderBy: { label: "asc" },
        include: {
          bookings: {
            where: {
              status: { not: "CANCELLED" },
              checkIn: { lte: end },
              checkOut: { gte: start },
            },
            orderBy: { checkIn: "asc" },
          },
        },
      },
    },
  });

  return { services, rangeStart: start, rangeEnd: end };
}

/**
 * Creates a walk-in / front-desk booking directly against a specific unit
 * for a date range. Guest info is optional here — it can be filled in
 * later via updateBookingGuestInfo (e.g. at actual check-in time).
 */
export async function createUnitBooking(
  slug: string,
  input: {
    serviceId: string;
    unitId: string;
    checkIn: string;
    checkOut: string;
    guestName?: string;
    guestPhone?: string;
  }
): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };

  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) {
    return { success: false, error: "Check-out must be after check-in." };
  }

  const [service, unit, overlap] = await Promise.all([
    prisma.service.findFirst({ where: { id: input.serviceId, storeId: a.store.id } }),
    prisma.serviceUnit.findFirst({ where: { id: input.unitId, storeId: a.store.id, serviceId: input.serviceId } }),
    prisma.booking.findFirst({
      where: {
        unitId: input.unitId,
        status: { not: "CANCELLED" },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    }),
  ]);

  if (!service) return { success: false, error: "Service not found." };
  if (!unit) return { success: false, error: "Unit does not belong to this service." };
  if (overlap) return { success: false, error: "That unit is already booked for part of those dates." };

  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

  const booking = await prisma.booking.create({
    data: {
      storeId: a.store.id,
      serviceId: input.serviceId,
      unitId: input.unitId,
      scheduledAt: checkIn,
      checkIn,
      checkOut,
      durationMins: nights * 24 * 60,
      status: "CONFIRMED",
      guestName: input.guestName?.trim() || null,
      guestPhone: input.guestPhone?.trim() || null,
    },
  });

  revalidatePath(`/store/${slug}/admin/calendar`);
  return { success: true, data: { id: booking.id } };
}

/**
 * Fills in or edits a guest's details on an existing booking — usable at
 * creation or any time after (e.g. when the guest actually arrives and
 * hands over ID).
 */
export async function updateBookingGuestInfo(
  slug: string,
  bookingId: string,
  input: {
    guestName?: string;
    guestPhone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    governmentIdType?: string;
    governmentIdNumber?: string;
    governmentIdImageUrl?: string;
    notes?: string;
  }
): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, storeId: a.store.id } });
  if (!booking) return { success: false, error: "Booking not found." };

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      guestName: input.guestName?.trim() || null,
      guestPhone: input.guestPhone?.trim() || null,
      emergencyContactName: input.emergencyContactName?.trim() || null,
      emergencyContactPhone: input.emergencyContactPhone?.trim() || null,
      governmentIdType: input.governmentIdType?.trim() || null,
      governmentIdNumber: input.governmentIdNumber?.trim() || null,
      governmentIdImageUrl: input.governmentIdImageUrl?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath(`/store/${slug}/admin/calendar`);
  return { success: true, data: undefined };
}

/**
 * Housekeeping status update for a unit (e.g. mark a room dirty after
 * check-out, clean and ready after servicing).
 */
export async function updateUnitStatus(
  slug: string,
  unitId: string,
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "DIRTY" | "CLEANING" | "MAINTENANCE" | "OUT_OF_SERVICE"
): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };

  const unit = await prisma.serviceUnit.findFirst({ where: { id: unitId, storeId: a.store.id } });
  if (!unit) return { success: false, error: "Unit not found." };

  await prisma.serviceUnit.update({ where: { id: unitId }, data: { status } });

  revalidatePath(`/store/${slug}/admin/calendar`);
  return { success: true, data: undefined };
}

/** Marks a booking as checked out and its unit as needing cleaning. */
export async function checkOutUnitBooking(slug: string, bookingId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, storeId: a.store.id } });
  if (!booking) return { success: false, error: "Booking not found." };

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED" } }),
    ...(booking.unitId ? [prisma.serviceUnit.update({ where: { id: booking.unitId }, data: { status: "DIRTY" } })] : []),
  ]);

  revalidatePath(`/store/${slug}/admin/calendar`);
  return { success: true, data: undefined };
}
