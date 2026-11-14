/**
 * Pure decision for "may this card open this door right now?". No database, no network,
 * so the rules can be tested without a hotel.
 */
export type DoorCard = {
  id: string;
  roomId: string;
  status: "ACTIVE" | "REVOKED";
  expiresAt: Date | null;
  reservation: { status: string; checkOut: Date } | null;
};
export type DoorRoom = { id: string; status: string };
export type DoorReaderInfo = { roomId: string | null };
export type AccessDecision = { allowed: boolean; reason: string };

export const READER_TOKEN_RE = /^[a-f0-9]{40}$/;

/** Reservation states in which a key card may open a door. */
const LIVE_STAY = new Set(["CONFIRMED", "CHECKED_IN"]);

export function decideAccess(input: { card: DoorCard | null; cardRoom: DoorRoom | null; reader: DoorReaderInfo; now?: Date }): AccessDecision {
  const now = input.now ?? new Date();
  const { card, cardRoom, reader } = input;
  if (!card) return { allowed: false, reason: "Unknown card" };
  if (card.status !== "ACTIVE") return { allowed: false, reason: "Card was deactivated" };
  if (card.expiresAt && card.expiresAt <= now) return { allowed: false, reason: "Card expired" };
  if (reader.roomId && reader.roomId !== card.roomId) return { allowed: false, reason: "Card is for a different room" };
  if (card.reservation) {
    if (!LIVE_STAY.has(card.reservation.status)) return { allowed: false, reason: "Stay is not active" };
    if (card.reservation.checkOut <= now) return { allowed: false, reason: "Stay has ended" };
  }
  if (cardRoom && ["OUT_OF_SERVICE", "MAINTENANCE"].includes(cardRoom.status)) return { allowed: false, reason: "Room is out of service" };
  return { allowed: true, reason: "OK" };
}
