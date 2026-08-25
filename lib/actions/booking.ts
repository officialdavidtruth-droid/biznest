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
 * Checks whether the currently authenticated user has access
 * to manage the specified store's bookings.
 *
 * Store owners are allowed.
 * Platform admins and support moderators are allowed.
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

  const isOwner = store.business.userId === session.user.id;

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
 * Returns all available booking start times for a service on a
 * particular date.
 *
 * Availability comes from the service's weekly availability settings.
 * Existing bookings are removed from the result.
 * Past times are also removed when the selected date is today.
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

  if (!service || !service.isBookable || !service.durationMins) {
    return [];
  }

  const availability =
    (service.availability as WeeklyAvailability | null) ?? null;

  if (!availability) {
    return [];
  }

  const date = new Date(`${dateISO}T00:00:00`);

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

  /**
   * Convert every availability window into bookable slots.
   *
   * Example:
   * 09:00 - 12:00
   * duration = 60
   *
   * Results:
   * 09:00
   * 10:00
   * 11:00
   */
  for (const [start, end] of windows) {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);

    if (
      Number.isNaN(startH) ||
      Number.isNaN(startM) ||
      Number.isNaN(endH) ||
      Number.isNaN(endM)
    ) {
      continue;
    }

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes + duration <= endMinutes) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;

      slots.push(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
          2,
          "0"
        )}`
      );

      currentMinutes += duration;
    }
  }

  /**
   * Find existing bookings for this service on this date.
   *
   * Cancelled bookings do not block the slot.
   */
  const dayStart = new Date(`${dateISO}T00:00:00`);
  const dayEnd = new Date(`${dateISO}T23:59:59.999`);

  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
    return [];
  }

  const existing = await prisma.booking.findMany({
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
      durationMins: true,
    },
  });

  /**
   * Treat an existing booking as occupying its complete duration.
   *
   * This prevents a second customer from booking a slot that overlaps
   * an existing longer appointment.
   */
  const takenIntervals = existing.map((booking) => {
    const start = booking.scheduledAt.getTime();

    const end =
      start +
      booking.durationMins * 60 * 1000;

    return {
      start,
      end,
    };
  });

  /**
   * Remove slots that overlap an existing booking.
   */
  const availableSlots = slots.filter((slot) => {
    const [hours, minutes] = slot.split(":").map(Number);

    const slotDate = new Date(`${dateISO}T00:00:00`);

    if (Number.isNaN(slotDate.getTime())) {
      return false;
    }

    slotDate.setHours(hours, minutes, 0, 0);

    const slotStart = slotDate.getTime();

    const slotEnd =
      slotStart +
      duration * 60 * 1000;

    const overlapsExisting = takenIntervals.some(
      (interval) =>
        slotStart < interval.end &&
        slotEnd > interval.start
    );

    if (overlapsExisting) {
      return false;
    }

    return true;
  });

  /**
   * Don't show times that have already passed today.
   */
  const now = new Date();

  const isToday =
    dayStart.getFullYear() === now.getFullYear() &&
    dayStart.getMonth() === now.getMonth() &&
    dayStart.getDate() === now.getDate();

  if (!isToday) {
    return availableSlots;
  }

  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();

  return availableSlots.filter((slot) => {
    const [hours, minutes] = slot.split(":").map(Number);

    const slotMinutes =
      hours * 60 +
      minutes;

    return slotMinutes > currentMinutes;
  });
}

/**
 * Customer creates a booking.
 *
 * IMPORTANT:
 * Store customer authentication is intentionally isolated from
 * the normal BizNest admin authentication.
 *
 * getStoreCustomerSession() currently accepts NO arguments.
 * Therefore the store is verified separately using the service's
 * storeId and requireStoreCustomerByStoreId().
 */
export async function createBooking(
  storeSlug: string,
  serviceId: string,
  dateISO: string,
  time: string,
  notes: string
): Promise<ActionResult<{ bookingId: string }>> {
  /**
   * IMPORTANT FIX:
   *
   * Do NOT pass storeSlug here.
   *
   * The current getStoreCustomerSession() function accepts zero
   * arguments.
   */
  const customerSession = await getStoreCustomerSession();

  const session = customerSession
    ? {
        user: {
          id: customerSession.id,
          role: "CUSTOMER" as const,
          customerStoreId: customerSession.storeId,
        },
      }
    : await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      error: "Please sign in to book.",
    };
  }

  /**
   * Rate-limit booking attempts to prevent abuse.
   */
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

  /**
   * Find the service.
   */
  const service = await prisma.service.findUnique({
    where: {
      id: serviceId,
    },
  });

  if (!service || !service.isBookable || !service.durationMins) {
    return {
      success: false,
      error: "This service isn't bookable.",
    };
  }

  /**
   * Verify that the service actually belongs to the requested store.
   *
   * This prevents somebody from sending:
   *
   * /store-a
   *
   * while supplying a service belonging to:
   *
   * store-b
   */
  const store = await prisma.store.findUnique({
    where: {
      slug: storeSlug,
    },
    select: {
      id: true,
      slug: true,
      status: true,
    },
  });

  if (!store) {
    return {
      success: false,
      error: "Store not found.",
    };
  }

  if (store.status !== "ACTIVE") {
    return {
      success: false,
      error: "This store isn't available.",
    };
  }

  if (service.storeId !== store.id) {
    return {
      success: false,
      error: "This service does not belong to this store.",
    };
  }

  /**
   * Store customers must belong to the same store as the service.
   *
   * This is the important isolation check that prevents a customer
   * session from Store A being used to create a booking at Store B.
   */
  if (session.user.role === "CUSTOMER") {
    const membership = await requireStoreCustomerByStoreId(
      service.storeId
    );

    if (!membership) {
      return {
        success: false,
        error:
          "This customer account belongs to another store. Sign up for this store to continue.",
      };
    }
  }

  /**
   * Validate the requested date.
   */
  const requestedDate = new Date(`${dateISO}T00:00:00`);

  if (Number.isNaN(requestedDate.getTime())) {
    return {
      success: false,
      error: "Invalid booking date.",
    };
  }

  /**
   * Validate the requested time before using it.
   */
  const timeParts = time.split(":");

  if (timeParts.length !== 2) {
    return {
      success: false,
      error: "Invalid booking time.",
    };
  }

  const [h, m] = timeParts.map(Number);

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

  /**
   * Make sure the selected slot is actually available.
   */
  const available = await getAvailableSlots(
    serviceId,
    dateISO
  );

  if (!available.includes(time)) {
    return {
      success: false,
      error: "That slot was just taken — pick another time.",
    };
  }

  /**
   * Build the actual scheduled datetime.
   */
  const scheduledAt = new Date(`${dateISO}T00:00:00`);

  if (Number.isNaN(scheduledAt.getTime())) {
    return {
      success: false,
      error: "Invalid booking date.",
    };
  }

  scheduledAt.setHours(h, m, 0, 0);

  /**
   * Final race-condition check.
   *
   * Another customer could theoretically create the same booking
   * between getAvailableSlots() and prisma.booking.create().
   *
   * Check the database again immediately before creating it.
   */
  const bookingEnd = new Date(
    scheduledAt.getTime() +
      service.durationMins * 60 * 1000
  );

  const overlappingBooking =
    await prisma.booking.findFirst({
      where: {
        serviceId,
        status: {
          not: "CANCELLED",
        },
        scheduledAt: {
          lt: bookingEnd,
        },
        AND: [
          {
            scheduledAt: {
              gte: new Date(
                scheduledAt.getTime() -
                  service.durationMins * 60 * 1000
              ),
            },
          },
        ],
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMins: true,
      },
    });

  if (overlappingBooking) {
    const existingStart =
      overlappingBooking.scheduledAt.getTime();

    const existingEnd =
      existingStart +
      overlappingBooking.durationMins * 60 * 1000;

    const requestedStart =
      scheduledAt.getTime();

    const requestedEnd =
      bookingEnd.getTime();

    const overlaps =
      requestedStart < existingEnd &&
      requestedEnd > existingStart;

    if (overlaps) {
      return {
        success: false,
        error: "That slot was just taken — pick another time.",
      };
    }
  }

  /**
   * Create the booking.
   */
  const booking = await prisma.booking.create({
    data: {
      storeId: service.storeId,
      serviceId,
      buyerId: session.user.id,
      scheduledAt,
      durationMins: service.durationMins,
      notes: notes?.trim() || null,
    },
  });

  /**
   * Notify external integrations.
   */
  await emitWebhookEvent(
    "BOOKING_CREATED",
    service.storeId,
    {
      bookingId: booking.id,
      serviceId,
      scheduledAt: booking.scheduledAt,
      durationMins: booking.durationMins,
    }
  );

  /**
   * Refresh the relevant storefront/admin pages.
   */
  revalidatePath(`/store/${storeSlug}`);
  revalidatePath(`/store/${storeSlug}/admin/services`);

  return {
    success: true,
    data: {
      bookingId: booking.id,
    },
  };
}

/**
 * Lists all bookings for the store owner/staff dashboard.
 */
export async function listBookings(slug: string) {
  const access = await assertStoreAccess(slug);

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
 * Updates a booking status.
 *
 * Allowed statuses:
 *
 * CONFIRMED
 * COMPLETED
 * CANCELLED
 */
export async function updateBookingStatus(
  slug: string,
  bookingId: string,
  status:
    | "CONFIRMED"
    | "COMPLETED"
    | "CANCELLED"
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);

  if (!access.success) {
    return {
      success: false,
      error: access.error,
    };
  }

  const booking = await prisma.booking.findFirst({
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

  /**
   * Don't perform unnecessary database writes.
   */
  if (booking.status === status) {
    return {
      success: true,
      data: undefined,
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

  /**
   * Notify connected integrations.
   */
  if (status === "CONFIRMED") {
    await emitWebhookEvent(
      "BOOKING_CONFIRMED",
      access.store.id,
      {
        bookingId,
        status,
      }
    );
  }

  if (status === "CANCELLED") {
    await emitWebhookEvent(
      "BOOKING_CANCELLED",
      access.store.id,
      {
        bookingId,
        status,
      }
    );
  }

  /**
   * Refresh the admin booking/service page.
   */
  revalidatePath(
    `/store/${slug}/admin/services`
  );

  return {
    success: true,
    data: undefined,
  };
}