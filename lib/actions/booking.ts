"use server";

import { auth } from "@/lib/auth";
import { getStoreCustomerSession } from "@/lib/store-customer-auth";
import { prisma } from "@/lib/prisma";
import { requireStoreCustomerByStoreId } from "@/lib/actions/store-customer";
import { checkRateLimit } from "@/lib/rate-limit";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

type WeeklyAvailability = Partial<
  Record<
    "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
    [string, string][]
  >
>;

const DAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

/**
 * Checks whether the currently authenticated BizNest user
 * has access to manage the specified store.
 *
 * Store customers do NOT pass through this function.
 * They use the separate store-customer authentication system.
 */
async function assertStoreAccess(slug: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false as const,
      error: "You must be signed in.",
    };
  }

  const store = await prisma.store.findUnique({
    where: {
      slug,
    },
    include: {
      business: true,
    },
  });

  if (!store) {
    return {
      success: false as const,
      error: "Store not found.",
    };
  }

  const isOwner =
    store.business.userId === session.user.id;

  const isStaff =
    session.user.role === "PLATFORM_ADMIN" ||
    session.user.role === "SUPPORT_MODERATOR";

  if (!isOwner && !isStaff) {
    return {
      success: false as const,
      error: "You don't have access to this store.",
    };
  }

  return {
    success: true as const,
    store,
  };
}

/**
 * Returns available start times for a service on a given date.
 *
 * Existing bookings are removed from the available slots.
 * Slots that have already passed today are also removed.
 */
export async function getAvailableSlots(
  serviceId: string,
  dateISO: string
): Promise<string[]> {
  const service = await prisma.service.findUnique({
    where: {
      id: serviceId,
    },
  });

  if (
    !service ||
    !service.isBookable ||
    !service.durationMins
  ) {
    return [];
  }

  const availability =
    (service.availability as WeeklyAvailability | null) ??
    null;

  if (!availability) {
    return [];
  }

  const date = new Date(
    `${dateISO}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return [];
  }

  const dayKey = DAY_KEYS[date.getDay()];
  const windows = availability[dayKey];

  if (!windows || windows.length === 0) {
    return [];
  }

  const duration = service.durationMins;
  const slots: string[] = [];

  for (const [start, end] of windows) {
    let [h, m] = start.split(":").map(Number);

    const [endH, endM] = end
      .split(":")
      .map(Number);

    const endMinutes =
      endH * 60 + endM;

    while (
      h * 60 + m + duration <=
      endMinutes
    ) {
      slots.push(
        `${String(h).padStart(2, "0")}:${String(
          m
        ).padStart(2, "0")}`
      );

      m += duration;

      if (m >= 60) {
        h += Math.floor(m / 60);
        m %= 60;
      }
    }
  }

  const dayStart = new Date(
    `${dateISO}T00:00:00`
  );

  const dayEnd = new Date(
    `${dateISO}T23:59:59`
  );

  const existing =
    await prisma.booking.findMany({
      where: {
        serviceId,
        scheduledAt: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: {
          not: "CANCELLED",
        },
      },
      select: {
        scheduledAt: true,
      },
    });

  const taken = new Set(
    existing.map((booking) => {
      const d = booking.scheduledAt;

      return `${String(
        d.getHours()
      ).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`;
    })
  );

  // Don't offer slots that have already passed today.
  const now = new Date();

  const isToday =
    dayStart.toDateString() ===
    now.toDateString();

  return slots.filter((slot) => {
    if (taken.has(slot)) {
      return false;
    }

    if (!isToday) {
      return true;
    }

    const [sh, sm] = slot
      .split(":")
      .map(Number);

    const slotMinutes =
      sh * 60 + sm;

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes();

    return slotMinutes > currentMinutes;
  });
}

/**
 * Customer creates a booking.
 *
 * Store customers use the isolated store-customer
 * authentication cookie.
 *
 * Admin/staff users continue using the normal
 * BizNest authentication session.
 */
export async function createBooking(
  storeSlug: string,
  serviceId: string,
  dateISO: string,
  time: string,
  notes: string,
  staffId?: string
): Promise<
  ActionResult<{ bookingId: string }>
> {
  /**
   * IMPORTANT:
   *
   * getStoreCustomerSession() returns:
   *
   * {
   *   user: {
   *     id,
   *     name,
   *     email,
   *     role,
   *     customerStoreId
   *   }
   * }
   *
   * Therefore we MUST use:
   *
   * customerSession.user.id
   *
   * and NOT:
   *
   * customerSession.id
   */
  const customerSession =
    await getStoreCustomerSession();

  const session = customerSession
    ? {
        user: {
          id: customerSession.user.id,
          role: "CUSTOMER" as const,
          customerStoreId:
            customerSession.user.customerStoreId,
          email: customerSession.user.email,
          name: customerSession.user.name,
        },
      }
    : await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      error: "Please sign in to book.",
    };
  }

  const rate = await checkRateLimit(
    `booking:${session.user.id}`,
    10,
    5 * 60 * 1000
  );

  if (!rate.allowed) {
    return {
      success: false,
      error:
        "Too many booking attempts — please wait a few minutes and try again.",
    };
  }

  const service =
    await prisma.service.findUnique({
      where: {
        id: serviceId,
      },
    });

  if (
    !service ||
    !service.isBookable ||
    !service.durationMins
  ) {
    return {
      success: false,
      error: "This service isn't bookable.",
    };
  }

  const durationMins = service.durationMins;

  /**
   * Store customers are restricted to their own store.
   *
   * This prevents a customer logged into Store A
   * from creating a booking against Store B.
   */
  if (
    session.user.role === "CUSTOMER"
  ) {
    const membership =
      await requireStoreCustomerByStoreId(
        service.storeId
      );

    if (!membership) {
      return {
        success: false,
        error:
          "This customer account belongs to another store. Sign up for this store to continue.",
      };
    }

    /**
     * Extra protection:
     *
     * The authenticated customer session itself
     * must belong to the same store as the service.
     */
    if (
      session.user.customerStoreId !==
      service.storeId
    ) {
      return {
        success: false,
        error:
          "This customer account belongs to another store. Sign up for this store to continue.",
      };
    }
  }

  /**
   * Verify that the supplied date/time is actually
   * available immediately before creating the booking.
   */
  const available =
    await getAvailableSlots(
      serviceId,
      dateISO
    );

  if (!available.includes(time)) {
    return {
      success: false,
      error:
        "That slot was just taken — pick another time.",
    };
  }

  const [h, m] = time
    .split(":")
    .map(Number);

  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return {
      success: false,
      error: "Invalid booking time.",
    };
  }

  const scheduledAt = new Date(
    `${dateISO}T00:00:00`
  );

  if (
    Number.isNaN(
      scheduledAt.getTime()
    )
  ) {
    return {
      success: false,
      error: "Invalid booking date.",
    };
  }

  scheduledAt.setHours(
    h,
    m,
    0,
    0
  );

  if (staffId) {
    const assignment = await prisma.serviceStaff.findFirst({
      where: { serviceId, staffId, staff: { storeId: service.storeId, status: "ACTIVE" } },
      select: { id: true },
    });
    if (!assignment) return { success: false, error: "That specialist is not available for this service." };
  }

  let booking: { id: string; scheduledAt: Date; durationMins: number };
  try {
    booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findMany({
      where: {
        serviceId,
        status: { not: "CANCELLED" },
        ...(staffId ? { staffId } : {}),
        scheduledAt: { lt: new Date(scheduledAt.getTime() + durationMins * 60000), gte: new Date(scheduledAt.getTime() - 24 * 60 * 60000) },
      },
      select: { scheduledAt: true, durationMins: true },
    });
    const end = new Date(scheduledAt.getTime() + durationMins * 60000);
    if (existing.some(b => b.scheduledAt < end && new Date(b.scheduledAt.getTime() + b.durationMins * 60000) > scheduledAt)) {
      throw new Error("BOOKING_SLOT_TAKEN");
    }
    return tx.booking.create({
      data: {
        storeId: service.storeId,
        serviceId,
        buyerId: session.user.id,
        scheduledAt,
        durationMins: durationMins,
        notes: notes?.trim() || null,
        staffId: staffId || null,
      },
    });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "BOOKING_SLOT_TAKEN") return { success: false, error: "That slot was just taken — pick another time." };
    throw error;
  }

  await emitWebhookEvent(
    "BOOKING_CREATED",
    service.storeId,
    {
      bookingId: booking.id,
      serviceId,
      scheduledAt:
        booking.scheduledAt,
      durationMins:
        booking.durationMins,
    }
  );

  revalidatePath(
    `/store/${storeSlug}`
  );

  return {
    success: true,
    data: {
      bookingId: booking.id,
    },
  };
}

/**
 * Lists bookings for the store owner/staff dashboard.
 */
export async function listBookings(
  slug: string
) {
  const access =
    await assertStoreAccess(slug);

  if (!access.success) {
    return [];
  }

  return prisma.booking.findMany({
    where: {
      storeId: access.store.id,
    },
    include: {
      service: true,
      buyer: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      scheduledAt: "asc",
    },
  });
}

/**
 * Updates booking status.
 *
 * Only the store owner or authorized platform
 * staff can perform this action.
 */
export async function updateBookingStatus(
  slug: string,
  bookingId: string,
  status:
    | "CONFIRMED"
    | "COMPLETED"
    | "CANCELLED"
): Promise<ActionResult> {
  const access =
    await assertStoreAccess(slug);

  if (!access.success) {
    return {
      success: false,
      error: access.error,
    };
  }

  const booking =
    await prisma.booking.findFirst({
      where: {
        id: bookingId,
        storeId: access.store.id,
      },
    });

  if (!booking) {
    return {
      success: false,
      error: "Booking not found.",
    };
  }

  await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      status,
    },
  });

  if (status === "CONFIRMED") {
    await emitWebhookEvent(
      "BOOKING_CONFIRMED",
      access.store.id,
      {
        bookingId,
        status,
      }
    );
  } else if (
    status === "CANCELLED"
  ) {
    await emitWebhookEvent(
      "BOOKING_CANCELLED",
      access.store.id,
      {
        bookingId,
        status,
      }
    );
  }

  revalidatePath(
    `/store/${slug}/admin/services`
  );

  return {
    success: true,
    data: undefined,
  };
}
/** Staff who can perform a service and are active in the store. */
export async function getBookableStaff(serviceId: string, dateISO?: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { storeId: true } });
  if (!service) return [];
  const rows = await prisma.serviceStaff.findMany({
    where: { serviceId, staff: { storeId: service.storeId, status: "ACTIVE" } },
    include: { staff: { select: { id: true, invitedName: true, position: true, user: { select: { name: true } } } } },
  });
  return rows.filter(r => r.staff).map(r => ({ id: r.staff.id, name: r.staff.user?.name || r.staff.invitedName || r.staff.position || "Team member", position: r.staff.position }));
}

/** Returns the number of free units for a requested stay. */
export async function getAvailableUnitCount(serviceId: string, checkInISO: string, checkOutISO: string) {
  const checkIn = new Date(`${checkInISO}T00:00:00`);
  const checkOut = new Date(`${checkOutISO}T00:00:00`);
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) return 0;
  const units = await prisma.serviceUnit.findMany({ where: { serviceId, status: { notIn: ["OUT_OF_SERVICE", "MAINTENANCE"] } }, select: { id: true } });
  if (!units.length) return 0;
  const booked = await prisma.booking.count({ where: { serviceId, unitId: { in: units.map(u => u.id) }, status: { not: "CANCELLED" }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } });
  return Math.max(0, units.length - booked);
}

/** Customer-facing booking for a unit/date-range service such as a hotel room. */
export async function createCustomerUnitBooking(storeSlug: string, serviceId: string, checkInISO: string, checkOutISO: string, notes: string): Promise<ActionResult<{ bookingId: string }>> {
  const customerSession = await getStoreCustomerSession();
  if (!customerSession?.user?.id) return { success: false, error: "Please sign in to book." };
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true, storeId: true, price: true, totalUnits: true, isBookable: true } });
  if (!service?.isBookable || !service.totalUnits) return { success: false, error: "This service is not configured for date-range booking." };
  const membership = await requireStoreCustomerByStoreId(service.storeId);
  if (!membership || customerSession.user.customerStoreId !== service.storeId) return { success: false, error: "This customer account belongs to another business." };
  const checkIn = new Date(`${checkInISO}T00:00:00`), checkOut = new Date(`${checkOutISO}T00:00:00`);
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) return { success: false, error: "Choose a valid check-in and check-out date." };
  const unit = await prisma.serviceUnit.findFirst({ where: { serviceId, status: { notIn: ["OUT_OF_SERVICE", "MAINTENANCE"] }, bookings: { none: { status: { not: "CANCELLED" }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } } }, orderBy: { label: "asc" } });
  if (!unit) return { success: false, error: "Those dates are no longer available. Please choose different dates." };
  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
  const booking = await prisma.booking.create({ data: { storeId: service.storeId, serviceId, unitId: unit.id, buyerId: customerSession.user.id, scheduledAt: checkIn, checkIn, checkOut, durationMins: nights * 1440, status: "PENDING", notes: notes?.trim() || null } });
  await emitWebhookEvent("BOOKING_CREATED", service.storeId, { bookingId: booking.id, serviceId, scheduledAt: booking.scheduledAt, checkIn, checkOut });
  revalidatePath(`/store/${storeSlug}`);
  revalidatePath(`/store/${storeSlug}/account/bookings`);
  return { success: true, data: { bookingId: booking.id } };
}

/** Prevent overlapping appointment bookings, including different durations. */
export async function hasBookingConflict(serviceId: string, start: Date, durationMins: number, staffId?: string) {
  const end = new Date(start.getTime() + durationMins * 60000);
  const candidates = await prisma.booking.findMany({
    where: {
      serviceId,
      status: { not: "CANCELLED" },
      ...(staffId ? { staffId } : {}),
      scheduledAt: { lt: end, gte: new Date(start.getTime() - 24 * 60 * 60000) },
    },
    select: { scheduledAt: true, durationMins: true },
  });
  return candidates.some(b => b.scheduledAt.getTime() < end.getTime() && b.scheduledAt.getTime() + b.durationMins * 60000 > start.getTime());
}
