import { describe, expect, it, vi } from "vitest";
import { addPeriod, effectiveMonthlyFor, paidPeriod, periodFlag, priceFor, yearlyPriceFor, yearlySavingsFor } from "../period";
import { buildSubscriptionReference } from "@/lib/payments/subscription-reference";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("yearly pricing", () => {
  it("takes 15% off twelve months, in whole naira", () => {
    expect(yearlyPriceFor(10000)).toBe(102000);
    expect(yearlyPriceFor(45000)).toBe(459000);
    expect(yearlyPriceFor(139000)).toBe(1417800);
  });
  it("reports the saving against twelve monthly payments", () => {
    expect(yearlySavingsFor(10000)).toBe(18000);
    expect(yearlySavingsFor(45000)).toBe(81000);
    expect(yearlySavingsFor(139000)).toBe(250200);
  });
  it("prices monthly unchanged", () => {
    expect(priceFor(45000, "MONTHLY")).toBe(45000);
    expect(priceFor(45000, "YEARLY")).toBe(459000);
  });
  it("shows the per-month equivalent of a yearly plan", () => {
    expect(effectiveMonthlyFor(10000, "YEARLY")).toBe(8500);
    expect(effectiveMonthlyFor(10000, "MONTHLY")).toBe(10000);
  });
});

describe("addPeriod", () => {
  it("adds a month or a year", () => {
    expect(addPeriod(new Date(2026, 10, 18), "MONTHLY").toDateString()).toBe(new Date(2026, 11, 18).toDateString());
    expect(addPeriod(new Date(2026, 10, 18), "YEARLY").toDateString()).toBe(new Date(2027, 10, 18).toDateString());
  });
  it("clamps month ends instead of rolling over", () => {
    expect(addPeriod(new Date(2027, 0, 31), "MONTHLY").toDateString()).toBe(new Date(2027, 1, 28).toDateString());
    expect(addPeriod(new Date(2027, 1, 28), "YEARLY").toDateString()).toBe(new Date(2028, 1, 28).toDateString());
  });
});

describe("paidPeriod", () => {
  const store = "cm0abcdefghijklmnopqrstuv";
  const plan = "cm0plan12345678901234abcd";
  it("round-trips the period through the reference", () => {
    const yearly = buildSubscriptionReference(store, plan, "YEARLY");
    const monthly = buildSubscriptionReference(store, plan, "MONTHLY");
    expect(yearly.length).toBeLessThanOrEqual(50);
    expect(yearly.split("-")[3][0]).toBe(periodFlag("YEARLY"));
    expect(paidPeriod(yearly, yearlyPriceFor(45000), 45000)).toBe("YEARLY");
    expect(paidPeriod(monthly, 45000, 45000)).toBe("MONTHLY");
  });
  it("never grants a year for a monthly-priced charge", () => {
    const yearly = buildSubscriptionReference(store, plan, "YEARLY");
    expect(paidPeriod(yearly, 45000, 45000)).toBe("MONTHLY");
  });
  it("treats references with no flag as monthly", () => {
    expect(paidPeriod("SUBUP-a-b-c", yearlyPriceFor(45000), 45000)).toBe("MONTHLY");
  });
});
