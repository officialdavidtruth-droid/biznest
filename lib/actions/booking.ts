"use server";

import { auth } from "@/lib/auth";
import { getStoreCustomerSession } from "@/lib/store-customer-auth";
import { prisma } from "@/lib/prisma";
import { requireStoreCustomerByStoreId } from "@/lib/actions/store-customer";
import { checkRateLimit } from "@/lib/rate-limit";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { ActionResult } from "@/types/actions";

// Shared by createBooking/createStayBooking: what to tell the shopper when
// the database rejects the write because someone else just took the slot.
// This is the message that matters -- see the P2002 catch below for why the
// earlier findFirst check alone can't be trusted to catch this.
const SLOT_TAKEN_MESSAGE = "That slot was just taken — pick another time.";

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
 * Staff who can perform a given service and are still active in the
 * store — used to render the "choose a specialist" step of the
 * storefront booking widget. Returns [] for services with no staff
 * assignments, in which case the widget just skips that step.
 */
export async function getBookableStaff(serviceId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { storeId: true },
  });
  if (!service) return [];

  const rows = await prisma.serviceStaff.findMany({
    where: { serviceId, staff: { storeId: service.storeId, status: "ACTIVE" } },
    include: {
      staff: {
        select: { id: true, invitedName: true, position: true, user: { select: { name: true } } },
      },
    },
  });

  return rows
    .filter((r) => r.staff)
    .map((r) => ({
      id: r.staff.id,
      name: r.staff.user?.name || r.staff.invitedName || r.staff.position || "Team member",
      position: r.staff.position,
    }));
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
  guest?: { name: string; email: string; phone: string },
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

  const initialSession = customerSession
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

  if (!initialSession?.user?.id && !guest) {
    return { success: false, error: "Enter your name, email and phone to book as a guest." };
  }

  const normalizedGuest = guest
    ? {
        name: guest.name.trim(),
        email: guest.email.trim().toLowerCase(),
        phone: guest.phone.trim(),
      }
    : null;

  if (!initialSession?.user?.id && (!normalizedGuest?.name || !normalizedGuest.email || !normalizedGuest.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedGuest.email))) {
    return { success: false, error: "Please provide a valid name, email and phone number." };
  }

  const rateKey = initialSession?.user?.id ? `booking:${initialSession.user.id}` : `booking-guest:${normalizedGuest!.email}:${serviceId}`;
  const rate = await checkRateLimit(
    rateKey,
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
   *
   * IMPORTANT: if the person is signed in as a customer of a *different*
   * store, we don't hard-block them here -- the booking widget already
   * collects guest name/email/phone as a fallback, and there is no way
   * for a mobile visitor to "sign up for this store" mid-booking without
   * losing their place. So: if valid guest details were submitted
   * alongside a mismatched/foreign session, we book as a guest instead
   * of rejecting the booking outright. The hard block remains for the
   * case with no usable guest details to fall back to.
   */
  let session = initialSession;
  if (
    session?.user?.role === "CUSTOMER"
  ) {
    const membership =
      await requireStoreCustomerByStoreId(
        service.storeId
      );

    const sessionBelongsToThisStore =
      Boolean(membership) &&
      session.user.customerStoreId === service.storeId;

    if (!sessionBelongsToThisStore) {
      if (normalizedGuest?.name && normalizedGuest.email && normalizedGuest.phone) {
        // Fall back to a guest booking under the details actually typed
        // into the form, rather than the foreign-store session.
        session = null;
      } else {
        return {
          success: false,
          error:
            "This customer account belongs to another store. Enter your name, email and phone below to continue as a guest, or sign up for this store to save it to your account.",
        };
      }
    }
  }

  /**
   * If a specific staff member/specialist was requested, confirm
   * they actually perform this service and are still active before
   * we go any further.
   */
  if (staffId) {
    const assignment = await prisma.serviceStaff.findFirst({
      where: { serviceId, staffId, staff: { storeId: service.storeId, status: "ACTIVE" } },
      select: { id: true },
    });
    if (!assignment) {
      return { success: false, error: "That specialist is not available for this service." };
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
        // When a specific staff member is requested, only a booking
        // against that same person at that same time is a real
        // conflict — other specialists (or the unassigned queue)
        // remain free for this slot.
        ...(staffId ? { staffId } : {}),
      },
      select: {
        id: true,
      },
    });

  if (conflictingBooking) {
    return {
      success: false,
      error: SLOT_TAKEN_MESSAGE,
    };
  }

  /**
   * Duplicate-booking guard.
   *
   * Blocks a new booking if the same customer (by account id, or by
   * guest email when booking without an account) already has a PENDING
   * booking for this exact service + scheduled time. This catches
   * accidental double-submits (double-tap, back-button retry, refresh)
   * without blocking legitimate repeat bookings for a different date/time.
   */
  const duplicateBooking = await prisma.booking.findFirst({
    where: {
      serviceId,
      scheduledAt,
      status: "PENDING",
      ...(session?.user?.id
        ? { buyerId: session.user.id }
        : { guestEmail: normalizedGuest!.email }),
    },
    select: { id: true },
  });

  if (duplicateBooking) {
    return {
      success: false,
      error:
        "You already have a pending booking for this service at this date and time.",
    };
  }

  /**
   * The findFirst conflict check above is a fast, friendly early check --
   * it's *not* what actually prevents double-booking, since two requests
   * can both pass it before either finishes creating. The real guarantee
   * is the partial unique index on (serviceId, staffId, scheduledAt) added
   * in prisma/migrations/20260828170000_booking_slot_unique_constraint,
   * which the database enforces atomically. If a second request loses that
   * race, Prisma throws P2002 here and we turn it into the same friendly
   * error instead of a 500.
   */
  let booking;
  try {
    booking = await prisma.booking.create({
      data: {
        storeId: service.storeId,
        serviceId,
        buyerId: session?.user?.id ?? null,
        scheduledAt,
        durationMins:
          service.durationMins,
        notes: notes?.trim() || null,
        staffId: staffId || null,
        guestName: normalizedGuest?.name ?? null,
        guestEmail: normalizedGuest?.email ?? null,
        guestPhone: normalizedGuest?.phone ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: SLOT_TAKEN_MESSAGE };
    }
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
 * Public storefront equivalent of getCalendarData's overlap check, scoped to
 * a single unit-based service. Returns how many of its units are free for
 * the given [checkIn, checkOut) range so the stay-booking widget can tell
 * the shopper up front whether the dates work at all.
 */
export async function getAvailableUnitCount(
  serviceId: string,
  checkInISO: string,
  checkOutISO: string
): Promise<number> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isBookable || !service.totalUnits) return 0;

  const checkIn = new Date(`${checkInISO}T00:00:00`);
  const checkOut = new Date(`${checkOutISO}T00:00:00`);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) return 0;

  const totalUnits = await prisma.serviceUnit.count({ where: { serviceId, status: { not: "OUT_OF_SERVICE" } } });
  if (totalUnits === 0) return 0;

  const bookedUnitIds = await prisma.booking.findMany({
    where: {
      serviceId,
      status: { not: "CANCELLED" },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { unitId: true },
    distinct: ["unitId"],
  });

  return Math.max(0, totalUnits - bookedUnitIds.length);
}

/**
 * When every unit is booked for the shopper's requested dates, instead of
 * telling them "no availability" and leaving them stuck, walk forward
 * day-by-day (keeping the same length of stay) and return the next window
 * where at least one unit is actually free -- sourced from real Booking
 * rows, so it stays in lockstep with whatever the admin/front-desk side has
 * booked. Works for any unit-based service (rooms, tables, bays, kit
 * rentals, etc.), not just hotel rooms.
 */
export async function getNextAvailableStay(
  serviceId: string,
  checkInISO: string,
  checkOutISO: string,
  horizonDays = 60
): Promise<{ checkIn: string; checkOut: string } | null> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isBookable || !service.totalUnits) return null;

  const totalUnits = await prisma.serviceUnit.count({ where: { serviceId, status: { not: "OUT_OF_SERVICE" } } });
  if (totalUnits === 0) return null;

  const startIn = new Date(`${checkInISO}T00:00:00`);
  const startOut = new Date(`${checkOutISO}T00:00:00`);
  if (Number.isNaN(startIn.getTime()) || Number.isNaN(startOut.getTime()) || startOut <= startIn) return null;
  const stayMs = startOut.getTime() - startIn.getTime();

  // Pull every relevant booking once, then scan candidate windows against it
  // in memory rather than round-tripping to the DB for each day.
  const horizonEnd = new Date(startIn.getTime() + horizonDays * 86400000 + stayMs);
  const bookings = await prisma.booking.findMany({
    where: {
      serviceId,
      status: { not: "CANCELLED" },
      checkIn: { lt: horizonEnd },
      checkOut: { gt: startIn },
    },
    select: { unitId: true, checkIn: true, checkOut: true },
  });

  for (let offset = 1; offset <= horizonDays; offset++) {
    const candidateIn = new Date(startIn.getTime() + offset * 86400000);
    const candidateOut = new Date(candidateIn.getTime() + stayMs);
    const overlapping = new Set(
      bookings
        .filter((b) => b.checkIn && b.checkOut && b.checkIn < candidateOut && b.checkOut > candidateIn)
        .map((b) => b.unitId)
    );
    if (overlapping.size < totalUnits) {
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      return { checkIn: iso(candidateIn), checkOut: iso(candidateOut) };
    }
  }
  return null;
}

/**
 * Public storefront counterpart to createUnitBooking (front-desk version in
 * lib/actions/service-unit.ts). Picks the first free unit for the requested
 * range itself, rather than asking the shopper to choose a specific room.
 */
export async function createStayBooking(
  storeSlug: string,
  serviceId: string,
  checkInISO: string,
  checkOutISO: string,
  notes: string,
  guest?: { name: string; email: string; phone: string }
): Promise<ActionResult<{ bookingId: string }>> {
  const customerSession = await getStoreCustomerSession();
  const initialSession = customerSession
    ? {
        user: {
          id: customerSession.user.id,
          role: "CUSTOMER" as const,
          customerStoreId: customerSession.user.customerStoreId,
          email: customerSession.user.email,
          name: customerSession.user.name,
        },
      }
    : await auth();

  if (!initialSession?.user?.id && !guest) {
    return { success: false, error: "Enter your name, email and phone to book as a guest." };
  }

  const normalizedGuest = guest
    ? { name: guest.name.trim(), email: guest.email.trim().toLowerCase(), phone: guest.phone.trim() }
    : null;

  if (!initialSession?.user?.id && (!normalizedGuest?.name || !normalizedGuest.email || !normalizedGuest.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedGuest.email))) {
    return { success: false, error: "Please provide a valid name, email and phone number." };
  }

  const rateKey = initialSession?.user?.id ? `booking:${initialSession.user.id}` : `booking-guest:${normalizedGuest!.email}:${serviceId}`;
  const rate = await checkRateLimit(rateKey, 10, 5 * 60 * 1000);
  if (!rate.allowed) {
    return { success: false, error: "Too many booking attempts — please wait a few minutes and try again." };
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isBookable || !service.totalUnits) {
    return { success: false, error: "This service isn't bookable." };
  }

  // Same fallback as createBooking above: a session tied to a different
  // store doesn't hard-block the stay booking if usable guest details were
  // submitted alongside it -- it books as a guest instead.
  let session = initialSession;
  if (session?.user?.role === "CUSTOMER") {
    const membership = await requireStoreCustomerByStoreId(service.storeId);
    const sessionBelongsToThisStore = Boolean(membership) && session.user.customerStoreId === service.storeId;
    if (!sessionBelongsToThisStore) {
      if (normalizedGuest?.name && normalizedGuest.email && normalizedGuest.phone) {
        session = null;
      } else {
        return {
          success: false,
          error:
            "This customer account belongs to another store. Enter your name, email and phone below to continue as a guest, or sign up for this store to save it to your account.",
        };
      }
    }
  }

  const checkIn = new Date(`${checkInISO}T00:00:00`);
  const checkOut = new Date(`${checkOutISO}T00:00:00`);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return { success: false, error: "Invalid dates." };
  }
  if (checkIn < new Date(new Date().toDateString())) {
    return { success: false, error: "Check-in date is in the past." };
  }

  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

  /**
   * Duplicate-booking guard (stay bookings).
   *
   * Blocks a new booking if the same customer already has an identical
   * PENDING booking for this service with the exact same check-in/check-out
   * dates — same idea as the appointment guard above, adapted for stays.
   */
  const duplicateStayBooking = await prisma.booking.findFirst({
    where: {
      serviceId,
      checkIn,
      checkOut,
      status: "PENDING",
      ...(session?.user?.id
        ? { buyerId: session.user.id }
        : { guestEmail: normalizedGuest!.email }),
    },
    select: { id: true },
  });

  if (duplicateStayBooking) {
    return {
      success: false,
      error:
        "You already have a pending booking for this service with these dates.",
    };
  }

  // Race-condition-safe: pick a free unit and create the booking inside one
  // Serializable transaction so two shoppers can't both land on the same
  // last-free unit. Postgres itself detects the conflict here (rather than
  // relying on a unique index the way createBooking now does above) because
  // "free unit" is a range-overlap check, not an exact-match lookup a
  // simple unique constraint could express.
  //
  // Serializable transactions that lose a genuine race don't corrupt data,
  // but Postgres aborts the loser with a serialization-failure error (code
  // 40001) rather than silently retrying it. Left uncaught, the loser would
  // surface to the shopper as a raw 500 even though the fix is just "try
  // again" -- so we retry a couple of times before giving up.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const booking = await prisma.$transaction(async (tx) => {
        const units = await tx.serviceUnit.findMany({
          where: { serviceId, status: { not: "OUT_OF_SERVICE" } },
          select: { id: true },
        });
        if (units.length === 0) throw new Error("NO_UNITS");

        const overlapping = await tx.booking.findMany({
          where: {
            serviceId,
            status: { not: "CANCELLED" },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
          select: { unitId: true },
        });
        const takenIds = new Set(overlapping.map((b) => b.unitId));
        const freeUnit = units.find((u) => !takenIds.has(u.id));
        if (!freeUnit) throw new Error("NO_AVAILABILITY");

        return tx.booking.create({
          data: {
            storeId: service.storeId,
            serviceId,
            unitId: freeUnit.id,
            buyerId: session?.user?.id ?? null,
            scheduledAt: checkIn,
            checkIn,
            checkOut,
            durationMins: nights * 24 * 60,
            notes: notes?.trim() || null,
            guestName: normalizedGuest?.name ?? null,
            guestEmail: normalizedGuest?.email ?? null,
            guestPhone: normalizedGuest?.phone ?? null,
          },
        });
      }, { isolationLevel: "Serializable" });

      await emitWebhookEvent("BOOKING_CREATED", service.storeId, {
        bookingId: booking.id,
        serviceId,
        scheduledAt: booking.scheduledAt,
        durationMins: booking.durationMins,
      });

      revalidatePath(`/store/${storeSlug}`);
      return { success: true, data: { bookingId: booking.id } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "NO_UNITS" || message === "NO_AVAILABILITY") {
        return { success: false, error: "No rooms available for those dates — try a different range." };
      }
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.meta?.code === "40001");
      if (isSerializationFailure && attempt < MAX_ATTEMPTS) continue;
      if (isSerializationFailure) return { success: false, error: SLOT_TAKEN_MESSAGE };
      throw error;
    }
  }
  return { success: false, error: SLOT_TAKEN_MESSAGE };
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
          phone: true,
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
    | "PENDING"
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
  revalidatePath(
    `/store/${slug}/admin/bookings`
  );

  return {
    success: true,
    data: undefined,
  };
}