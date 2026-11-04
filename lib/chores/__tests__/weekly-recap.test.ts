import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendOrderNotificationEmail: vi.fn() }));

import { buildWeeklyRecap, hasWeeklyActivity } from "@/lib/chores/weekly-recap";

const base = { currency: "NGN", orders: 0, revenue: 0, prevOrders: 0, prevRevenue: 0, topItem: null };

describe("weekly recap", () => {
  it("stays silent for stores with no activity in either week", () => {
    expect(hasWeeklyActivity(base)).toBe(false);
    expect(hasWeeklyActivity({ ...base, prevOrders: 1 })).toBe(true);
  });

  it("reports sales, trend and best seller", () => {
    const { title, body } = buildWeeklyRecap("Ada Styles", { ...base, orders: 6, revenue: 150000, prevOrders: 4, prevRevenue: 100000, topItem: { name: "Ankara Dress", quantity: 3 } });
    expect(title).toBe("Ada Styles: your week");
    expect(body).toContain("6 paid orders");
    expect(body).toContain("up 50% on the week before");
    expect(body).toContain("Best seller: Ankara Dress (3 sold)");
  });

  it("handles a quiet week without inventing numbers", () => {
    const { body } = buildWeeklyRecap("Ada Styles", { ...base, prevOrders: 2, prevRevenue: 40000 });
    expect(body).toContain("No paid sales in the last 7 days.");
    expect(body).toContain("The week before: 2 orders");
    expect(body).not.toContain("Best seller");
  });

  it("says 'down' when revenue fell and uses singular for one order", () => {
    const { body } = buildWeeklyRecap("S", { ...base, orders: 1, revenue: 5000, prevOrders: 2, prevRevenue: 10000 });
    expect(body).toContain("1 paid order ·");
    expect(body).toContain("down 50%");
  });
});
