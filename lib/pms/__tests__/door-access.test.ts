import { describe, expect, it } from "vitest";
import { decideAccess, type DoorCard } from "@/lib/pms/door-access";

const now = new Date("2026-11-14T12:00:00Z");
const hour = 3_600_000;
const card = (over: Partial<DoorCard> = {}): DoorCard => ({
  id: "c1", roomId: "r1", status: "ACTIVE", expiresAt: new Date(now.getTime() + 5 * hour),
  reservation: { status: "CHECKED_IN", checkOut: new Date(now.getTime() + 5 * hour) }, ...over,
});
const room = { id: "r1", status: "OCCUPIED" };

describe("decideAccess", () => {
  it("opens the guest's own room", () => {
    expect(decideAccess({ card: card(), cardRoom: room, reader: { roomId: "r1" }, now })).toEqual({ allowed: true, reason: "OK" });
  });
  it("opens a shared door for any active card", () => {
    expect(decideAccess({ card: card(), cardRoom: room, reader: { roomId: null }, now }).allowed).toBe(true);
  });
  it("refuses another room's door", () => {
    expect(decideAccess({ card: card(), cardRoom: room, reader: { roomId: "r2" }, now }).reason).toBe("Card is for a different room");
  });
  it("refuses unknown, revoked and expired cards", () => {
    expect(decideAccess({ card: null, cardRoom: null, reader: { roomId: "r1" }, now }).allowed).toBe(false);
    expect(decideAccess({ card: card({ status: "REVOKED" }), cardRoom: room, reader: { roomId: "r1" }, now }).allowed).toBe(false);
    expect(decideAccess({ card: card({ expiresAt: new Date(now.getTime() - 1) }), cardRoom: room, reader: { roomId: "r1" }, now }).reason).toBe("Card expired");
  });
  it("refuses once the stay is over or cancelled", () => {
    expect(decideAccess({ card: card({ reservation: { status: "CHECKED_OUT", checkOut: new Date(now.getTime() + hour) } }), cardRoom: room, reader: { roomId: "r1" }, now }).allowed).toBe(false);
    expect(decideAccess({ card: card({ reservation: { status: "CHECKED_IN", checkOut: new Date(now.getTime() - 1) } }), cardRoom: room, reader: { roomId: "r1" }, now }).reason).toBe("Stay has ended");
  });
  it("refuses a room that is out of service", () => {
    expect(decideAccess({ card: card(), cardRoom: { id: "r1", status: "OUT_OF_SERVICE" }, reader: { roomId: "r1" }, now }).allowed).toBe(false);
  });
});
