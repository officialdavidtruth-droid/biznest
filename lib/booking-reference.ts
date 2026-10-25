import { randomInt } from "crypto";

/**
 * Booking codes are 7 characters, upper-case letters and digits. The look-alike
 * characters (0/O, 1/I/L) are left out so a code read over the phone or typed
 * from a printed email is hard to get wrong. 31^7 is roughly 27 billion codes.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const BOOKING_CODE_LENGTH = 7;

export function generateBookingReference(): string {
  let out = "";
  for (let i = 0; i < BOOKING_CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

type BookingLookup = { booking: { findUnique: (args: { where: { referenceCode: string }; select: { id: true } }) => Promise<{ id: string } | null> } };

/** A code that no existing booking uses. The DB unique index is the final guard. */
export async function generateUniqueBookingReference(db: BookingLookup): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateBookingReference();
    const clash = await db.booking.findUnique({ where: { referenceCode: code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new Error("Could not allocate a booking reference.");
}

/** What to show a guest: the short code, or the original ID for older bookings. */
export function bookingDisplayRef(b: { id: string; referenceCode?: string | null }): string {
  return b.referenceCode || b.id;
}
