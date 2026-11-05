import { describe, expect, it } from "vitest";
import { sanitizeFlight, readFlight, normaliseTicketNumber, flightSummary, flightClientLines, publicFlight, ticketsIssued, ticketingState, ticketingAlertDue, formatLocalDateTime, emptyFlight } from "../travel-flight";

const ok = (raw: unknown) => { const r = sanitizeFlight(raw); if (!r.ok) throw new Error(r.error); return r.flight; };
const err = (raw: unknown) => { const r = sanitizeFlight(raw); return r.ok ? null : r.error; };
const base = { airline: "Emirates", flightNumber: "ek 783", origin: "los", destination: "dxb", departAt: "2027-06-01T08:30", arriveAt: "2027-06-01T19:45", pnr: "x7k2pq", cabin: "Economy", baggage: "2 x 23kg", tickets: [{ name: "Ada Obi", number: "176 1234567890" }] };

describe("sanitizeFlight", () => {
  it("normalises codes and ticket numbers", () => {
    expect(ok(base)).toMatchObject({ flightNumber: "EK783", origin: "LOS", destination: "DXB", pnr: "X7K2PQ", tickets: [{ name: "Ada Obi", number: "176-1234567890" }] });
  });
  it("returns null when everything is empty, so details can be removed", () => {
    expect(ok({})).toBeNull();
    expect(ok(null)).toBeNull();
    expect(ok({ airline: "  ", tickets: [{ name: "x", number: "" }] })).toBeNull();
  });
  it("names the first thing that is wrong", () => {
    expect(err({ flightNumber: "783" })).toMatch(/Flight number/);
    expect(err({ origin: "Lagos" })).toMatch(/From/);
    expect(err({ destination: "DX" })).toMatch(/To/);
    expect(err({ departAt: "2027-02-30T08:00" })).toMatch(/departure/);
    expect(err({ arriveAt: "tomorrow" })).toMatch(/arrival/);
    expect(err({ pnr: "AB" })).toMatch(/PNR/);
    expect(err({ tickets: [{ name: "A", number: "12345" }] })).toMatch(/10 to 14 digits/);
  });
  it("rejects duplicate tickets and non-objects", () => {
    expect(err({ tickets: [{ number: "1761234567890" }, { number: "176-1234567890" }] })).toMatch(/twice/);
    expect(err("nope")).toMatch(/not valid/);
  });
  it("strips control characters and caps lengths", () => {
    const f = ok({ airline: "A\u0000ir\nline".repeat(30), baggage: "b".repeat(500) })!;
    expect(f.airline.length).toBeLessThanOrEqual(60);
    expect(f.baggage.length).toBe(80);
    expect(f.airline).not.toMatch(/[\u0000\n]/);
  });
  it("readFlight tolerates garbage in the database", () => {
    expect(readFlight({ flightNumber: "bad bad" })).toBeNull();
    expect(readFlight(base)?.flightNumber).toBe("EK783");
  });
});

describe("display", () => {
  const f = ok(base)!;
  it("formats times and a summary", () => {
    expect(formatLocalDateTime("2027-06-01T08:30")).toBe("1 Jun 2027 08:30");
    expect(formatLocalDateTime("junk")).toBe("");
    expect(flightSummary(f)).toBe("Emirates EK783 · LOS → DXB · 1 Jun 2027 08:30 → 1 Jun 2027 19:45");
    expect(flightSummary({ ...emptyFlight(), airline: "Air Peace" })).toBe("Air Peace");
  });
  it("keeps the booking reference and tickets private unless allowed", () => {
    const open = flightClientLines(f, true).join("\n");
    expect(open).toContain("Booking ref: X7K2PQ");
    expect(open).toContain("Ticket Ada Obi: 176-1234567890");
    const shut = flightClientLines(f, false).join("\n");
    expect(shut).not.toContain("X7K2PQ");
    expect(shut).not.toContain("1234567890");
    expect(shut).toContain("Baggage: 2 x 23kg");
  });
  it("hides private fields on the public link until accepted", () => {
    expect(publicFlight(f, false)).toMatchObject({ pnr: "", tickets: [], flightNumber: "EK783" });
    expect(publicFlight(f, true)?.pnr).toBe("X7K2PQ");
    expect(publicFlight(null, true)).toBeNull();
  });
});

describe("ticketing", () => {
  const now = new Date("2027-05-10T12:00:00Z");
  const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
  it("knows when every traveller has a ticket", () => {
    expect(ticketsIssued(ok(base), 1)).toBe(true);
    expect(ticketsIssued(ok(base), 2)).toBe(false);
    expect(ticketsIssued(null, 1)).toBe(false);
  });
  it("classifies the deadline", () => {
    expect(ticketingState(day(10), false, now)).toBe("later");
    expect(ticketingState(day(1), false, now)).toBe("soon");
    expect(ticketingState(day(-1), false, now)).toBe("overdue");
    expect(ticketingState(day(-1), true, now)).toBeNull();
    expect(ticketingState(null, false, now)).toBeNull();
  });
  it("alerts once, from 2 days before to a week after", () => {
    expect(ticketingAlertDue(day(1), false, false, now)).toBe(true);
    expect(ticketingAlertDue(day(-3), false, false, now)).toBe(true);
    expect(ticketingAlertDue(day(5), false, false, now)).toBe(false);
    expect(ticketingAlertDue(day(-9), false, false, now)).toBe(false);
    expect(ticketingAlertDue(day(1), true, false, now)).toBe(false);
    expect(ticketingAlertDue(day(1), false, true, now)).toBe(false);
    expect(ticketingAlertDue(null, false, false, now)).toBe(false);
  });
  it("ticket numbers: 13 digits get a dash, bad lengths are refused", () => {
    expect(normaliseTicketNumber("1761234567890")).toBe("176-1234567890");
    expect(normaliseTicketNumber("12345678901")).toBe("12345678901");
    expect(normaliseTicketNumber("123")).toBeNull();
    expect(normaliseTicketNumber("17612345678901234")).toBeNull();
  });
});
