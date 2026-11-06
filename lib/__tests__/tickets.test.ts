import { describe, expect, it } from "vitest";
import {
  eventOpenForSale, isTicketCode, newTicketCode, normaliseCode, priceOrder, sanitizeBuyer, sanitizeEvent, sanitizeTier, scanVerdict, slugifyTitle, tierState, type TierLike,
} from "@/lib/tickets";

const now = new Date("2026-11-06T10:00:00Z");
const tier = (o: Partial<TierLike> = {}): TierLike => ({ id: "t1", name: "Regular", price: 5000, capacity: 100, sold: 0, maxPerOrder: 5, saleEndsAt: null, active: true, ...o });

describe("ticket codes", () => {
  it("generates unique 16-char codes from the safe alphabet", () => {
    const codes = new Set(Array.from({ length: 500 }, newTicketCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(isTicketCode(c)).toBe(true);
  });
  it("normalises typed or URL input", () => {
    expect(normaliseCode(" abcd-efgh jkmn-pqrs ")).toBe("ABCDEFGHJKMNPQRS");
    expect(normaliseCode("https://x.test/t?c=abcdefghjkmnpqrs")).toBe("ABCDEFGHJKMNPQRS");
    expect(isTicketCode("ABCDEFGHJKMNPQRS")).toBe(true);
    expect(isTicketCode("ABCDEFGHJKMNPQR0")).toBe(false);
  });
});

describe("tierState and eventOpenForSale", () => {
  it("classifies tiers", () => {
    expect(tierState(tier(), now)).toBe("ON_SALE");
    expect(tierState(tier({ sold: 100 }), now)).toBe("SOLD_OUT");
    expect(tierState(tier({ saleEndsAt: new Date("2026-11-01") }), now)).toBe("SALE_ENDED");
    expect(tierState(tier({ active: false }), now)).toBe("OFF");
  });
  it("closes sales after the event", () => {
    expect(eventOpenForSale({ status: "PUBLISHED", startsAt: "2026-12-01T18:00:00Z" }, now)).toBe(true);
    expect(eventOpenForSale({ status: "DRAFT", startsAt: "2026-12-01T18:00:00Z" }, now)).toBe(false);
    expect(eventOpenForSale({ status: "PUBLISHED", startsAt: "2026-11-01T18:00:00Z" }, now)).toBe(false);
    expect(eventOpenForSale({ status: "PUBLISHED", startsAt: "2026-11-01T18:00:00Z", endsAt: "2026-11-07T00:00:00Z" }, now)).toBe(true);
  });
});

describe("priceOrder", () => {
  it("prices from the tiers and merges duplicate lines", () => {
    const r = priceOrder([tier()], [{ tierId: "t1", qty: 2 }, { tierId: "t1", qty: 1 }], now);
    expect(r).toMatchObject({ ok: true, total: 15000, count: 3 });
  });
  it("rejects empty, sold out, over-limit and unknown", () => {
    expect(priceOrder([tier()], [], now)).toMatchObject({ ok: false });
    expect(priceOrder([tier()], [{ tierId: "t1", qty: 0 }], now)).toMatchObject({ ok: false });
    expect(priceOrder([tier({ sold: 100 })], [{ tierId: "t1", qty: 1 }], now)).toMatchObject({ ok: false, error: "Regular is sold out." });
    expect(priceOrder([tier()], [{ tierId: "t1", qty: 6 }], now)).toMatchObject({ ok: false });
    expect(priceOrder([tier({ sold: 98 })], [{ tierId: "t1", qty: 3 }], now)).toMatchObject({ ok: false, error: "Only 2 Regular tickets left." });
    expect(priceOrder([tier()], [{ tierId: "nope", qty: 1 }], now)).toMatchObject({ ok: false });
    expect(priceOrder([tier()], [{ tierId: "t1", qty: -1 }], now)).toMatchObject({ ok: false });
  });
  it("allows free tickets", () => {
    expect(priceOrder([tier({ price: 0 })], [{ tierId: "t1", qty: 2 }], now)).toMatchObject({ ok: true, total: 0 });
  });
});

describe("scanVerdict", () => {
  const ev = { id: "e1", status: "PUBLISHED" };
  it("admits a valid ticket and refuses the rest", () => {
    expect(scanVerdict({ status: "VALID", eventId: "e1", holderName: "Ada", tierName: "VIP" }, ev)).toMatchObject({ ok: true });
    expect(scanVerdict(null, ev)).toMatchObject({ ok: false, reason: "NOT_FOUND" });
    expect(scanVerdict({ status: "VALID", eventId: "e2" }, ev)).toMatchObject({ ok: false, reason: "WRONG_EVENT" });
    expect(scanVerdict({ status: "VOID", eventId: "e1" }, ev)).toMatchObject({ ok: false, reason: "VOID" });
    expect(scanVerdict({ status: "CHECKED_IN", eventId: "e1", checkedInAt: now }, ev)).toMatchObject({ ok: false, reason: "ALREADY_IN" });
    expect(scanVerdict({ status: "VALID", eventId: "e1" }, { id: "e1", status: "CANCELLED" })).toMatchObject({ ok: false, reason: "EVENT_CANCELLED" });
  });
});

describe("sanitizers", () => {
  it("validates events", () => {
    expect(sanitizeEvent({ title: " ", startsAt: "2026-12-01" })).toMatchObject({ ok: false });
    expect(sanitizeEvent({ title: "Gala", startsAt: "nope" })).toMatchObject({ ok: false });
    expect(sanitizeEvent({ title: "Gala", startsAt: "2026-12-02T10:00", endsAt: "2026-12-01T10:00" })).toMatchObject({ ok: false });
    expect(sanitizeEvent({ title: "Gala", startsAt: "2026-12-01T10:00" })).toMatchObject({ ok: true });
  });
  it("validates tiers", () => {
    expect(sanitizeTier({ name: "", capacity: 10 })).toMatchObject({ ok: false });
    expect(sanitizeTier({ name: "A", price: 50, capacity: 10 })).toMatchObject({ ok: false });
    expect(sanitizeTier({ name: "A", price: 1000, capacity: 0 })).toMatchObject({ ok: false });
    expect(sanitizeTier({ name: "A", price: 0, capacity: 10 })).toMatchObject({ ok: true });
  });
  it("validates buyers", () => {
    expect(sanitizeBuyer({ name: "Ada" })).toMatchObject({ ok: false });
    expect(sanitizeBuyer({ name: "Ada", email: "bad" })).toMatchObject({ ok: false });
    expect(sanitizeBuyer({ name: "Ada" }, false)).toMatchObject({ ok: true });
    expect(sanitizeBuyer({ name: "Ada", email: "A@b.co", phone: "0801 000 0000" })).toEqual({ ok: true, buyer: { name: "Ada", email: "a@b.co", phone: "08010000000" } });
  });
  it("slugifies", () => {
    expect(slugifyTitle("Lagos Night Market 2026!")).toBe("lagos-night-market-2026");
    expect(slugifyTitle("!!!")).toBe("event");
  });
});
