import { describe, expect, it } from "vitest";
import { countsAsSpent, filterOrders, itemsHeadline, orderPhase, progressIndex, relativeDay, spentByCurrency, statusBlurb } from "@/lib/orders-view";

describe("phases", () => {
  it("treats delivered orders as done, not active", () => {
    expect(orderPhase("PAID")).toBe("active");
    expect(orderPhase("IN_PROGRESS")).toBe("active");
    expect(orderPhase("DELIVERED")).toBe("delivered");
    expect(orderPhase("COMPLETED")).toBe("delivered");
    for (const s of ["CANCELLED", "REFUNDED", "DISPUTED", "SOMETHING_NEW"]) expect(orderPhase(s)).toBe("closed");
  });
  it("only paid and fulfilled orders count as spent", () => {
    expect(["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"].every(countsAsSpent)).toBe(true);
    expect(["CANCELLED", "REFUNDED", "DISPUTED"].some(countsAsSpent)).toBe(false);
  });
  it("maps progress and has a blurb for every known status", () => {
    expect(progressIndex("PAID")).toBe(0);
    expect(progressIndex("IN_PROGRESS")).toBe(1);
    expect(progressIndex("DELIVERED")).toBe(2);
    expect(progressIndex("CANCELLED")).toBeNull();
    for (const s of ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED", "DISPUTED"]) expect(statusBlurb(s)).not.toBe("");
  });
});

describe("relativeDay", () => {
  const now = new Date("2026-11-05T14:00:00Z");
  it("uses Lagos calendar days", () => {
    expect(relativeDay(new Date("2026-11-05T09:00:00Z"), now)).toBe("Today");
    expect(relativeDay(new Date("2026-11-04T23:30:00Z"), now)).toBe("Today"); // 00:30 on the 5th in Lagos
    expect(relativeDay(new Date("2026-11-04T10:00:00Z"), now)).toBe("Yesterday");
    expect(relativeDay(new Date("2026-11-02T10:00:00Z"), now)).toBe("3 days ago");
  });
  it("falls back to the full date after a week, and never says a future day", () => {
    expect(relativeDay(new Date("2026-08-25T10:00:00Z"), now, "25 Aug 2026")).toBe("25 Aug 2026");
    expect(relativeDay(new Date("2026-11-06T10:00:00Z"), now)).toBe("Today");
  });
});

describe("spentByCurrency", () => {
  it("sums per currency and ignores closed orders", () => {
    const r = spentByCurrency([
      { status: "PAID", currency: "NGN", total: 100.1 },
      { status: "DELIVERED", currency: "NGN", total: 12.2 },
      { status: "PAID", currency: "USD", total: 5 },
      { status: "REFUNDED", currency: "NGN", total: 9999 },
    ]);
    expect(r).toEqual([{ currency: "NGN", amount: 112.3 }, { currency: "USD", amount: 5 }]);
    expect(spentByCurrency([])).toEqual([]);
  });
});

describe("filterOrders", () => {
  const orders = [
    { id: "ckabc60rqnyw6", status: "PAID", items: [{ name: "Lol" }] },
    { id: "ckdef0v6i6tvo4", status: "PAID", items: [{ name: "TruthMusicDistribution" }, { name: "Cover art" }] },
    { id: "ckghi0q0cojtm6", status: "DELIVERED", items: [{ name: "CVBNN" }] },
    { id: "ckjkl0zzzzzzz1", status: "CANCELLED", items: [{ name: "Old thing" }] },
  ];
  it("filters by phase", () => {
    expect(filterOrders(orders, "active", "").map((o) => o.id)).toHaveLength(2);
    expect(filterOrders(orders, "delivered", "")).toHaveLength(1);
    expect(filterOrders(orders, "closed", "")).toHaveLength(1);
    expect(filterOrders(orders, "all", "")).toHaveLength(4);
  });
  it("searches item names and order numbers, ignoring case and a leading #", () => {
    expect(filterOrders(orders, "all", "truthmusic")).toHaveLength(1);
    expect(filterOrders(orders, "all", "cover")).toHaveLength(1);
    expect(filterOrders(orders, "all", "#60RQNYW6")).toHaveLength(1);
    expect(filterOrders(orders, "active", "cvbnn")).toHaveLength(0);
    expect(filterOrders(orders, "all", "   ")).toHaveLength(4);
  });
});

describe("itemsHeadline", () => {
  it("names the first item and counts the rest", () => {
    expect(itemsHeadline([])).toBe("Order");
    expect(itemsHeadline(["Lol"])).toBe("Lol");
    expect(itemsHeadline(["Lol", "B", "C"])).toBe("Lol + 2 more");
  });
});
