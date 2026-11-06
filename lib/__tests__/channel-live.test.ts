import { describe, expect, it } from "vitest";
import {
  buildPushPayload, MAX_INBOUND_EVENTS, overlaps, parseDay, parseInboundEvents, retryDelayMs, safePushUrl, signBody, toBusyRanges, verifySignature,
} from "@/lib/channels/live";

const secret = "s3cret-for-tests";
const body = JSON.stringify({ events: [{ type: "booking.cancelled", uid: "X1" }] });
const NOW = Date.parse("2026-12-01T10:00:00Z");
const ts = String(Math.floor(NOW / 1000));

describe("signatures", () => {
  it("accepts a correct signature", () => {
    expect(verifySignature({ secret, timestamp: ts, signature: signBody(secret, ts, body), rawBody: body, nowMs: NOW })).toBe(true);
  });
  it("rejects a wrong secret, a tampered body, missing parts and junk", () => {
    const sig = signBody(secret, ts, body);
    expect(verifySignature({ secret: "other", timestamp: ts, signature: sig, rawBody: body, nowMs: NOW })).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: sig, rawBody: body + " ", nowMs: NOW })).toBe(false);
    expect(verifySignature({ secret, timestamp: null, signature: sig, rawBody: body, nowMs: NOW })).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: null, rawBody: body, nowMs: NOW })).toBe(false);
    expect(verifySignature({ secret, timestamp: "abc", signature: sig, rawBody: body, nowMs: NOW })).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: "sha256=00", rawBody: body, nowMs: NOW })).toBe(false);
  });
  it("rejects replays outside the 5 minute window but accepts millisecond timestamps", () => {
    const old = String(Math.floor(NOW / 1000) - 600);
    expect(verifySignature({ secret, timestamp: old, signature: signBody(secret, old, body), rawBody: body, nowMs: NOW })).toBe(false);
    const ms = String(NOW);
    expect(verifySignature({ secret, timestamp: ms, signature: signBody(secret, ms, body), rawBody: body, nowMs: NOW })).toBe(true);
  });
});

describe("inbound events", () => {
  it("parses created, updated and cancelled events", () => {
    const r = parseInboundEvents({ events: [
      { type: "booking.created", uid: " A ", start: "2026-12-20", end: "2026-12-23", summary: "  Reserved  " },
      { type: "booking.cancelled", uid: "B" },
    ] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.events[0]).toMatchObject({ type: "booking.created", uid: "A", summary: "Reserved" });
      expect(r.events[1]).toEqual({ type: "booking.cancelled", uid: "B" });
    }
  });
  it("accepts a single bare event", () => {
    expect(parseInboundEvents({ type: "booking.created", uid: "A", start: "2026-12-20", end: "2026-12-21" }).ok).toBe(true);
  });
  it("rejects bad input", () => {
    const bad = (b: unknown) => expect(parseInboundEvents(b).ok).toBe(false);
    bad(null); bad("x"); bad({ events: [] });
    bad({ events: [{ type: "booking.created", uid: "A", start: "2026-12-23", end: "2026-12-20" }] });
    bad({ events: [{ type: "booking.created", uid: "A", start: "2026-02-31", end: "2026-03-02" }] });
    bad({ events: [{ type: "booking.created", uid: "A", start: "2026-12-01", end: "2028-12-01" }] });
    bad({ events: [{ type: "booking.created", start: "2026-12-20", end: "2026-12-21" }] });
    bad({ events: [{ type: "booking.exploded", uid: "A" }] });
    bad({ events: Array.from({ length: MAX_INBOUND_EVENTS + 1 }, (_, i) => ({ type: "booking.cancelled", uid: `u${i}` })) });
  });
  it("parses days strictly", () => {
    expect(parseDay("2026-12-20")?.toISOString()).toBe("2026-12-20T00:00:00.000Z");
    expect(parseDay("20/12/2026")).toBeNull();
    expect(parseDay(5)).toBeNull();
  });
});

describe("availability payload", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  it("sorts, dedupes, drops past stays and fixes zero-length ranges", () => {
    const from = d("2026-12-01");
    const busy = toBusyRanges([
      { start: d("2026-12-20"), end: d("2026-12-23"), source: "direct" },
      { start: d("2026-12-05"), end: d("2026-12-07"), source: "online" },
      { start: d("2026-12-20"), end: d("2026-12-23"), source: "direct" },
      { start: d("2026-10-01"), end: d("2026-10-05"), source: "direct" },
      { start: d("2026-12-30"), end: d("2026-12-30"), source: "other_channel" },
    ], { from });
    expect(busy).toEqual([
      { start: "2026-12-05", end: "2026-12-07", source: "online" },
      { start: "2026-12-20", end: "2026-12-23", source: "direct" },
      { start: "2026-12-30", end: "2026-12-31", source: "other_channel" },
    ]);
  });
  it("drops stays beyond the horizon", () => {
    expect(toBusyRanges([{ start: d("2030-01-01"), end: d("2030-01-03"), source: "direct" }], { from: d("2026-12-01") })).toEqual([]);
  });
  it("builds a payload without guest details", () => {
    const p = buildPushPayload({ seq: 4, now: new Date(NOW), property: "Test Hotel", room: { id: "r1", name: "Deluxe 1" }, channel: { id: "c1", provider: "BOOKING_COM" }, busy: [] });
    expect(p).toEqual({ event: "availability.updated", seq: 4, sentAt: "2026-12-01T10:00:00.000Z", property: "Test Hotel", room: { id: "r1", name: "Deluxe 1" }, channel: { id: "c1", provider: "BOOKING_COM" }, busy: [] });
  });
});

describe("misc", () => {
  it("backs off then plateaus", () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelayMs)).toEqual([60_000, 300_000, 1_800_000, 7_200_000, 21_600_000, 21_600_000]);
  });
  it("only allows https push addresses without credentials", () => {
    expect(safePushUrl("https://hooks.example.com/a?b=1")).toBe("https://hooks.example.com/a?b=1");
    expect(safePushUrl("http://hooks.example.com")).toBeNull();
    expect(safePushUrl("https://user:pw@hooks.example.com")).toBeNull();
    expect(safePushUrl("ftp://x")).toBeNull();
    expect(safePushUrl("not a url")).toBeNull();
    expect(safePushUrl("")).toBeNull();
  });
  it("overlap is end-exclusive", () => {
    const a = { start: new Date("2026-12-01"), end: new Date("2026-12-03") };
    expect(overlaps(a, { start: new Date("2026-12-03"), end: new Date("2026-12-05") })).toBe(false);
    expect(overlaps(a, { start: new Date("2026-12-02"), end: new Date("2026-12-05") })).toBe(true);
  });
});
