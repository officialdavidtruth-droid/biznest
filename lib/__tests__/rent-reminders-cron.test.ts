import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn(), update: vi.fn(), email: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { rentCharge: { findMany: m.findMany, update: m.update } } }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notify }));
vi.mock("@/lib/observability/cron", () => ({ withCronMonitor: (_n: string, h: (req: Request, ctx: object) => Promise<Response>) => (req: Request) => h(req, { fail: vi.fn() }) }));
vi.mock("@/lib/observability/log", () => ({ logInfo: vi.fn(), logError: vi.fn(), errorMeta: (e: unknown) => ({ e: String(e) }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/send", () => ({ sendOrderNotificationEmail: m.email, storeEmailBrand: (s: { name: string }) => ({ name: s.name }) }));

import { GET } from "@/app/api/cron/rent-reminders/route";

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
const charge = (over: Record<string, unknown> = {}) => ({
  id: "c1", label: "Rent Jan 2027", amount: "500000", dueDate: day(-2), reminderCount: 0, lastReminderAt: null,
  unit: { unitNo: "3B", tenantName: "Ada Obi", tenantEmail: "ada@x.com", portalToken: "tok-tok-tok-tok-tok-tok1", property: { name: "Block A" } },
  store: { id: "s1", name: "Homes", slug: "homes", logoUrl: null, themeColors: null, contactEmail: null, contactPhone: null, customDomain: null, customDomainStatus: "NONE" },
  ...over,
});
const run = async () => (await GET(new Request("https://x.test/api/cron/rent-reminders"))).json();

beforeEach(() => {
  vi.clearAllMocks();
  m.email.mockResolvedValue({ data: {}, error: null });
  m.notify.mockResolvedValue(undefined);
  m.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
});

describe("rent reminders", () => {
  it("emails an overdue charge with the tenant's own link and counts it", async () => {
    m.findMany.mockReset();
    m.findMany.mockResolvedValueOnce([charge()]).mockResolvedValueOnce([]);
    expect(await run()).toMatchObject({ reminded: 1, failures: 0 });
    expect(m.email.mock.calls[0][0]).toBe("ada@x.com");
    expect(m.email.mock.calls[0][1]).toMatch(/overdue/i);
    expect(m.email.mock.calls[0][2]).toContain("/rent/tok-tok-tok-tok-tok-tok1");
    expect(m.update.mock.calls[0][0]).toMatchObject({ where: { id: "c1" }, data: { reminderCount: { increment: 1 } } });
  });

  it("does not count a reminder whose email failed, so tomorrow retries it", async () => {
    m.findMany.mockReset();
    m.findMany.mockResolvedValueOnce([charge()]).mockResolvedValueOnce([]);
    m.email.mockResolvedValue({ data: null, error: { message: "bounced" } });
    expect(await run()).toMatchObject({ reminded: 0, failures: 1 });
    expect(m.update).not.toHaveBeenCalled();
  });

  it("skips charges that hit the cap or were reminded in the last 5 days", async () => {
    m.findMany.mockReset();
    m.findMany.mockResolvedValueOnce([charge({ id: "capped", reminderCount: 4 }), charge({ id: "recent", reminderCount: 1, lastReminderAt: day(-1) })]).mockResolvedValueOnce([]);
    expect(await run()).toMatchObject({ reminded: 0, failures: 0 });
    expect(m.email).not.toHaveBeenCalled();
  });

  it("sends each landlord one summary bell for rent that just went overdue", async () => {
    m.findMany.mockReset();
    m.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { storeId: "s1", amount: "100000", store: { slug: "homes", business: { user: { id: "owner1" } } } },
      { storeId: "s1", amount: "50000", store: { slug: "homes", business: { user: { id: "owner1" } } } },
    ]);
    expect(await run()).toMatchObject({ alerted: 1 });
    expect(m.notify).toHaveBeenCalledTimes(1);
    expect(m.notify.mock.calls[0][0]).toMatchObject({ userId: "owner1", type: "RENT_OVERDUE", url: "/store/homes/admin/real-estate" });
    expect(m.notify.mock.calls[0][0].title).toMatch(/2 rent payments/);
  });
});
