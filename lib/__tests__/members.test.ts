import { describe, expect, it } from "vitest";
import {
  MEMBER_PAY_PREFIX, buildEnrollment, checkInDecision, givingSummary, givingPath, memberPortalPath, membershipState, membersProfile, nextRenewal,
  periodText, renewalDue, sanitizeGift, sanitizeMember,
} from "@/lib/members";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("membersProfile", () => {
  it("picks labels by business type", () => {
    expect(membersProfile("Church").giving).toBe(true);
    expect(membersProfile("Beauty").membersLabel).toBe("Clients");
    expect(membersProfile("Health & Fitness").checkInLabel).toBe("Check-ins");
    expect(membersProfile(null).key).toBe("generic");
  });
});

describe("renewals", () => {
  it("computes the next date per interval", () => {
    expect(nextRenewal(d("2026-01-31"), "MONTHLY")?.getUTCMonth()).toBe(1);
    expect(nextRenewal(d("2026-01-01"), "WEEKLY")?.toISOString().slice(0, 10)).toBe("2026-01-08");
    expect(nextRenewal(d("2026-01-01"), "ANNUAL")?.getUTCFullYear()).toBe(2027);
    expect(nextRenewal(d("2026-01-01"), "ONCE")).toBeNull();
  });
  it("labels periods", () => {
    expect(periodText(d("2026-11-06"), "MONTHLY")).toBe("Nov 2026");
    expect(periodText(d("2026-11-06"), "WEEKLY")).toBe("week of 6 Nov");
  });
  it("renewalDue only for active memberships renewing within the lead time", () => {
    const now = d("2026-11-06");
    expect(renewalDue({ status: "ACTIVE", startsAt: d("2026-10-01"), renewsAt: d("2026-11-10") }, now)).toBe(true);
    expect(renewalDue({ status: "ACTIVE", startsAt: d("2026-10-01"), renewsAt: d("2026-12-10") }, now)).toBe(false);
    expect(renewalDue({ status: "PAUSED", startsAt: d("2026-10-01"), renewsAt: d("2026-11-10") }, now)).toBe(false);
    expect(renewalDue({ status: "ACTIVE", startsAt: d("2026-10-01"), renewsAt: null }, now)).toBe(false);
    expect(renewalDue({ status: "ACTIVE", startsAt: d("2026-10-01"), renewsAt: d("2026-11-10"), endsAt: d("2026-11-01") }, now)).toBe(false);
  });
});

describe("buildEnrollment", () => {
  it("bills a recurring plan and schedules the renewal", () => {
    const e = buildEnrollment({ name: "Monthly gym", kind: "MEMBERSHIP", price: 15000, interval: "MONTHLY" }, d("2026-11-06"));
    expect(e.firstCharge).toMatchObject({ amount: 15000, kind: "DUES", label: "Monthly gym: Nov 2026" });
    expect(e.renewsAt?.toISOString().slice(0, 10)).toBe("2026-12-06");
    expect(e.sessionsLeft).toBeNull();
  });
  it("bills a package once with sessions and expiry", () => {
    const e = buildEnrollment({ name: "Braids", kind: "PACKAGE", price: 40000, interval: "ONCE", sessions: 5, validityDays: 60 }, d("2026-11-06"));
    expect(e.renewsAt).toBeNull();
    expect(e.sessionsLeft).toBe(5);
    expect(e.endsAt?.toISOString().slice(0, 10)).toBe("2027-01-05");
    expect(e.firstCharge.kind).toBe("PACKAGE");
  });
});

describe("membershipState and check-in", () => {
  const now = d("2026-11-06");
  it("classifies", () => {
    expect(membershipState({ status: "ACTIVE", startsAt: d("2026-10-01") }, now)).toBe("ACTIVE");
    expect(membershipState({ status: "ACTIVE", startsAt: d("2026-10-01"), endsAt: d("2026-11-08") }, now)).toBe("EXPIRING");
    expect(membershipState({ status: "ACTIVE", startsAt: d("2026-10-01"), endsAt: d("2026-11-01") }, now)).toBe("EXPIRED");
    expect(membershipState({ status: "ACTIVE", startsAt: d("2026-10-01"), sessionsLeft: 0 }, now)).toBe("USED_UP");
    expect(membershipState({ status: "PAUSED", startsAt: d("2026-10-01") }, now)).toBe("PAUSED");
    expect(membershipState({ status: "ACTIVE", startsAt: d("2026-12-01") }, now)).toBe("NOT_STARTED");
  });
  it("uses a session only for counted packages", () => {
    const pack = { status: "ACTIVE", startsAt: d("2026-10-01"), sessionsLeft: 3 };
    expect(checkInDecision(pack, false, now)).toEqual({ ok: true, useSession: true });
    expect(checkInDecision({ ...pack, sessionsLeft: null }, false, now)).toEqual({ ok: true, useSession: false });
  });
  it("blocks overdue dues unless forced", () => {
    const m = { status: "ACTIVE", startsAt: d("2026-10-01") };
    expect(checkInDecision(m, true, now).ok).toBe(false);
    expect(checkInDecision(m, true, now, true).ok).toBe(true);
  });
  it("blocks cancelled, expired and used-up", () => {
    expect(checkInDecision({ status: "CANCELLED", startsAt: d("2026-10-01") }, false, now).ok).toBe(false);
    expect(checkInDecision({ status: "ACTIVE", startsAt: d("2026-10-01"), sessionsLeft: 0 }, false, now).ok).toBe(false);
  });
});

describe("sanitize", () => {
  it("requires a name and sane contacts", () => {
    expect(sanitizeMember({ name: "  " })).toMatchObject({ ok: false });
    expect(sanitizeMember({ name: "Test Person", email: "nope" })).toMatchObject({ ok: false });
    expect(sanitizeMember({ name: "Test  Person", email: "A@B.co", phone: "0801 000 0000" })).toEqual({ ok: true, member: { name: "Test Person", email: "a@b.co", phone: "08010000000" } });
  });
  it("bounds gifts", () => {
    expect(sanitizeGift({ fund: "", amount: 500 })).toMatchObject({ ok: false });
    expect(sanitizeGift({ fund: "General", amount: 50 })).toMatchObject({ ok: false });
    expect(sanitizeGift({ fund: "General", amount: 99_999_999 })).toMatchObject({ ok: false });
    expect(sanitizeGift({ fund: "General", amount: 1000, email: "bad" })).toMatchObject({ ok: false });
    expect(sanitizeGift({ fund: "General", amount: "2,500", name: " Ada " })).toEqual({ ok: true, gift: { fund: "General", amount: 2500, name: "Ada", email: null } });
  });
});

describe("givingSummary", () => {
  it("totals by fund and month", () => {
    const s = givingSummary([
      { fund: "Tithe", amount: 1000, paidAt: d("2026-10-05") },
      { fund: "Tithe", amount: 500, paidAt: d("2026-11-02") },
      { fund: null, amount: 250, paidAt: d("2026-11-03") },
      { fund: "X", amount: 0, paidAt: d("2026-11-03") },
    ]);
    expect(s.total).toBe(1750);
    expect(s.count).toBe(3);
    expect(s.byFund[0]).toEqual({ fund: "Tithe", total: 1500, count: 2 });
    expect(s.byMonth[0]).toEqual({ month: "2026-11", total: 750 });
  });
});

describe("paths", () => {
  it("builds portal and giving paths", () => {
    expect(MEMBER_PAY_PREFIX).toBe("MBR");
    expect(memberPortalPath("shop", "tok")).toBe("/store/shop/member/tok");
    expect(givingPath("shop")).toBe("/store/shop/give");
  });
});
