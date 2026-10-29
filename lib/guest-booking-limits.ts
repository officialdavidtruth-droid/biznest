import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Abuse limits for anonymous (guest) bookings, shared by createBooking and
 * createStayBooking so appointment and stay flows can't drift apart.
 *
 * Why this exists: an unpaid guest booking holds its slot/room for the whole
 * checkout window, and the original limiter was keyed on the guest-supplied
 * email, so a script that varies the email on every request was never
 * throttled and could keep a store's calendar blocked indefinitely.
 *
 * Layers (all must pass):
 *  1. per client IP   - burst and hourly attempt limits
 *  2. per store       - caps total guest attempts against one storefront
 *  3. per contact     - caps concurrent unpaid holds per email / phone
 *  4. per store holds - caps total concurrent unpaid guest holds
 */

export const GUEST_BOOKING_LIMITS = {
  ipBurst: { max: 8, windowMs: 5 * 60 * 1000 },
  ipHourly: { max: 25, windowMs: 60 * 60 * 1000 },
  storeBurst: { max: 60, windowMs: 10 * 60 * 1000 },
  maxHoldsPerContact: 3,
  maxGuestHoldsPerStore: 100,
} as const;

const TOO_MANY_ATTEMPTS =
  "Too many booking attempts — please wait a few minutes and try again.";
const TOO_MANY_HOLDS =
  "You already have several unpaid bookings in progress. Complete or wait for them to expire before booking again.";
const STORE_BUSY =
  "This store is receiving a lot of booking requests right now. Please try again shortly.";

export type GuestLimitResult = { ok: true } | { ok: false; error: string };

export async function enforceGuestBookingLimits(args: {
  storeId: string;
  ip: string;
  guest: { email: string; phone: string };
  /** Unpaid holds created before this instant have already expired. */
  holdCutoff: Date;
}): Promise<GuestLimitResult> {
  const { storeId, ip, guest, holdCutoff } = args;
  const L = GUEST_BOOKING_LIMITS;

  // Skip IP buckets when the IP can't be determined: "unknown" would lump
  // every such visitor into one bucket and lock legitimate guests out.
  if (ip && ip !== "unknown") {
    const burst = await checkRateLimit(`booking-guest-ip:${ip}`, L.ipBurst.max, L.ipBurst.windowMs);
    if (!burst.allowed) return { ok: false, error: TOO_MANY_ATTEMPTS };
    const hourly = await checkRateLimit(`booking-guest-ip-hr:${ip}`, L.ipHourly.max, L.ipHourly.windowMs);
    if (!hourly.allowed) return { ok: false, error: TOO_MANY_ATTEMPTS };
  }

  const store = await checkRateLimit(`booking-guest-store:${storeId}`, L.storeBurst.max, L.storeBurst.windowMs);
  if (!store.allowed) return { ok: false, error: STORE_BUSY };

  const unpaidGuestHold = {
    storeId,
    buyerId: null,
    status: "PENDING" as const,
    paymentStatus: { in: ["UNPAID", "PENDING"] as ("UNPAID" | "PENDING")[] },
    createdAt: { gte: holdCutoff },
  };

  const [contactHolds, storeHolds] = await Promise.all([
    prisma.booking.count({
      where: {
        ...unpaidGuestHold,
        OR: [{ guestEmail: guest.email }, { guestPhone: guest.phone }],
      },
    }),
    prisma.booking.count({ where: unpaidGuestHold }),
  ]);

  if (contactHolds >= L.maxHoldsPerContact) return { ok: false, error: TOO_MANY_HOLDS };
  if (storeHolds >= L.maxGuestHoldsPerStore) return { ok: false, error: STORE_BUSY };

  return { ok: true };
}
