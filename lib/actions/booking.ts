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
  notes: string
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

  /**
   * Final race-condition protection.
   *
   * Availability was checked above, but another
   * customer could theoretically book the same slot
   * between that check and this create().
   *
   * We therefore check once more immediately before
   * creating the booking.
   */
  const conflictingBooking =
    await prisma.booking.findFirst({
      where: {
        serviceId,
        scheduledAt,
        status: {
          not: "CANCELLED",
        },
      },
      select: {
        id: true,
      },
    });

  if (conflictingBooking) {
    return {
      success: false,
      error:
        "That slot was just taken — pick another time.",
    };
  }

  const booking =
    await prisma.booking.create({
      data: {
        storeId: service.storeId,
        serviceId,
        buyerId: session.user.id,
        scheduledAt,
        durationMins:
          service.durationMins,
        notes: notes?.trim() || null,
      },
    });

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