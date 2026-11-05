import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ itemFindMany: vi.fn(), itemUpdate: vi.fn(), notify: vi.fn(), payFindMany: vi.fn(), payUpdate: vi.fn(), tripFindMany: vi.fn(), tripUpdate: vi.fn(), entitlement: vi.fn(), email: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { travelPayment: { findMany: m.payFindMany, update: m.payUpdate }, travelTrip: { findMany: m.tripFindMany, update: m.tripUpdate }, travelTripItem: { findMany: m.itemFindMany, update: m.itemUpdate } } }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notify }));
vi.mock("@/lib/observability/cron", () => ({ withCronMonitor: (_n: string, h: (req: Request, ctx: object) => Promise<Response>) => (req: Request) => h(req, { fail: vi.fn() }) }));
vi.mock("@/lib/observability/log", () => ({ logInfo: vi.fn(), logError: vi.fn(), errorMeta: (e: unknown) => ({ e: String(e) }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/payments/travel-charge", () => ({ travelOnlinePaymentError: vi.fn() }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: m.entitlement }));
vi.mock("@/lib/email/send", () => ({ sendOrderNotificationEmail: m.email, storeEmailBrand: (s: { name: string }) => ({ name: s.name }) }));

import { GET } from "@/app/api/cron/travel-followups/route";

const store = (over: Record<string, unknown> = {}) => ({ id: "storeA", name: "Wander", slug: "wander", logoUrl: null, themeColors: null, contactEmail: null, contactPhone: null, customDomain: null, customDomainStatus: "NONE", travelSettings: null, ...over });
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
const due = (over: Record<string, unknown> = {}) => ({
  id: "p1", amount: "200000", dueDate: day(-2), reminderCount: 0, lastReminderAt: null,
  trip: { id: "trip1", title: "Dubai", reference: "TRV-1", currency: "NGN", shareToken: "tok-tok-tok-tok-tok-tok-1", client: { fullName: "Ada Obi", email: "ada@x.com" }, store: store() }, ...over,
});
const run = async () => (await GET(new Request("https://x.test/api/cron/travel-followups"))).json();

beforeEach(() => {
  vi.clearAllMocks();
  m.entitlement.mockResolvedValue({ allowed: true, installed: true });
  m.payFindMany.mockResolvedValue([]);
  m.tripFindMany.mockResolvedValue([]);
  m.itemFindMany.mockResolvedValue([]);
  m.notify.mockResolvedValue(undefined);
  m.email.mockResolvedValue({ data: {}, error: null });
});

describe("instalment reminders", () => {
  it("emails an overdue instalment with the client's own pay link, then counts it", async () => {
    m.payFindMany.mockResolvedValue([due()]);
    expect(await run()).toMatchObject({ reminded: 1, failures: 0 });
    expect(m.email.mock.calls[0][0]).toBe("ada@x.com");
    expect(m.email.mock.calls[0][1]).toMatch(/overdue/i);
    expect(m.email.mock.calls[0][2]).toContain("/travel/p/tok-tok-tok-tok-tok-tok-1");
    expect(m.payUpdate.mock.calls[0][0]).toMatchObject({ where: { id: "p1" }, data: { reminderCount: { increment: 1 } } });
  });

  it("creates a link for the client when the trip has none yet", async () => {
    const d = due(); d.trip.shareToken = null as unknown as string;
    m.payFindMany.mockResolvedValue([d]);
    await run();
    expect(m.tripUpdate.mock.calls[0][0].data.shareToken).toMatch(/^[A-Za-z0-9_-]{30,}$/);
  });

  it("does not count a reminder whose email failed, so tomorrow retries it", async () => {
    m.payFindMany.mockResolvedValue([due()]);
    m.email.mockResolvedValue({ data: null, error: { message: "bounced" } });
    expect(await run()).toMatchObject({ reminded: 0, failures: 1 });
    expect(m.payUpdate).not.toHaveBeenCalled();
  });

  it("respects the agency's switch, the app entitlement, the cap and the 5-day gap", async () => {
    m.payFindMany.mockResolvedValue([
      due({ id: "off", trip: { ...due().trip, store: store({ travelSettings: { remindersEnabled: false } }) } }),
      due({ id: "capped", reminderCount: 4 }),
      due({ id: "recent", reminderCount: 1, lastReminderAt: day(-1) }),
    ]);
    expect(await run()).toMatchObject({ reminded: 0 });
    m.payFindMany.mockResolvedValue([due()]);
    m.entitlement.mockResolvedValue({ allowed: true, installed: false });
    expect(await run()).toMatchObject({ reminded: 0 });
    expect(m.email).not.toHaveBeenCalled();
  });

  it("stays quiet for an instalment more than 3 days away", async () => {
    m.payFindMany.mockResolvedValue([due({ dueDate: day(10) })]);
    expect(await run()).toMatchObject({ reminded: 0 });
  });
});

describe("post-trip follow-up", () => {
  const completed = (over: Record<string, unknown> = {}) => ({ id: "trip9", title: "Dubai", client: { fullName: "Ada Obi", email: "ada@x.com" }, store: store({ travelSettings: { reviewUrl: "https://g.page/r/abc" } }), ...over });

  it("thanks the client with the agency's review link and stamps the trip", async () => {
    m.tripFindMany.mockResolvedValue([completed()]);
    expect(await run()).toMatchObject({ reviews: 1 });
    expect(m.email.mock.calls[0][1]).toBe("How was Dubai?");
    expect(m.email.mock.calls[0][2]).toContain("https://g.page/r/abc");
    expect(m.tripUpdate.mock.calls[0][0]).toMatchObject({ where: { id: "trip9" } });
    expect(m.tripUpdate.mock.calls[0][0].data.reviewRequestedAt).toBeInstanceOf(Date);
  });

  it("only looks at completed, not-yet-asked trips inside the 2 to 30 day window", async () => {
    await run();
    const where = m.tripFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: "COMPLETED", reviewRequestedAt: null });
    expect(where.OR).toHaveLength(2);
  });

  it("does not stamp a trip whose email failed", async () => {
    m.tripFindMany.mockResolvedValue([completed()]);
    m.email.mockResolvedValue({ data: null, error: { message: "bounced" } });
    expect(await run()).toMatchObject({ reviews: 0, failures: 1 });
    expect(m.tripUpdate).not.toHaveBeenCalled();
  });
});

describe("ticketing deadline alerts", () => {
  const flight = { airline: "Emirates", flightNumber: "EK783", tickets: [] as { name: string; number: string }[] };
  const line = (over: Record<string, unknown> = {}) => ({
    id: "i1", description: "Lagos–Dubai", ticketingDeadline: day(1), ticketingAlertedAt: null, flightDetails: flight,
    trip: { title: "Dubai", reference: "TRV-1", travellers: [{ id: "a" }, { id: "b" }], store: { id: "storeA", slug: "wander", business: { userId: "owner1" } } }, ...over,
  });

  it("alerts the owner once and stamps the line", async () => {
    m.itemFindMany.mockResolvedValue([line()]);
    expect(await run()).toMatchObject({ ticketing: 1, failures: 0 });
    expect(m.notify.mock.calls[0][0]).toMatchObject({ userId: "owner1", type: "TRAVEL_TICKETING", url: "/store/wander/admin/travel" });
    expect(m.notify.mock.calls[0][0].title).toMatch(/Issue tickets soon/);
    expect(m.itemUpdate.mock.calls[0][0]).toMatchObject({ where: { id: "i1" }, data: { ticketingAlertedAt: expect.any(Date) } });
  });
  it("says so when the deadline has already passed", async () => {
    m.itemFindMany.mockResolvedValue([line({ ticketingDeadline: day(-1) })]);
    await run();
    expect(m.notify.mock.calls[0][0].title).toMatch(/passed/);
  });
  it("stays quiet when every traveller already has a ticket", async () => {
    const f = { ...flight, tickets: [{ name: "A", number: "1761234567890" }, { name: "B", number: "1761234567891" }] };
    m.itemFindMany.mockResolvedValue([line({ flightDetails: f })]);
    expect(await run()).toMatchObject({ ticketing: 0 });
    expect(m.notify).not.toHaveBeenCalled();
  });
  it("skips stores without the app, and retries tomorrow if the alert fails", async () => {
    m.itemFindMany.mockResolvedValue([line()]);
    m.entitlement.mockResolvedValue({ allowed: true, installed: false });
    expect(await run()).toMatchObject({ ticketing: 0 });
    m.entitlement.mockResolvedValue({ allowed: true, installed: true });
    m.notify.mockRejectedValue(new Error("db down"));
    expect(await run()).toMatchObject({ ticketing: 0, failures: 1 });
    expect(m.itemUpdate).not.toHaveBeenCalled();
  });
  it("only looks at open flight lines inside the alert window", async () => {
    await run();
    const w = m.itemFindMany.mock.calls[0][0].where;
    expect(w).toMatchObject({ kind: "FLIGHT", ticketingAlertedAt: null });
    expect(w.trip.status.notIn).toEqual(["CANCELLED", "COMPLETED"]);
  });
});
