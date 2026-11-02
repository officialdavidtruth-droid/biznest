import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ find: vi.fn(), send: vi.fn(), logError: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { payment: { findUnique: m.find } } }));
vi.mock("@/lib/email/send", () => ({ sendOrderNotificationEmail: m.send, storeEmailBrand: (s: { name: string }) => ({ name: s.name }) }));
vi.mock("@/lib/observability/log", () => ({ logError: m.logError }));

import { sendTravelPaymentEmail } from "@/lib/payments/travel-confirmation";

const row = (over: Record<string, unknown> = {}, trip: Record<string, unknown> = {}) => ({
  purpose: "TRAVEL_BOOKING", status: "SUCCESSFUL", amount: "60000", currency: "NGN",
  travelTrip: {
    reference: "TRV-2611-ABCD", title: "Dubai <Escape>", destination: "Dubai", status: "CONFIRMED", totalPrice: "200000", departDate: new Date("2027-03-01"),
    client: { fullName: "Ada Obi", email: "ada@example.com" }, store: { name: "Wander Co", slug: "wander", customDomain: null, customDomainStatus: "NONE" },
    travellers: [{ id: "a" }, { id: "b" }], payments: [{ amount: "60000", status: "RECEIVED" }, { amount: "5000", status: "VOID" }], ...trip,
  },
  ...over,
});

beforeEach(() => { vi.clearAllMocks(); m.send.mockResolvedValue({}); });

describe("sendTravelPaymentEmail", () => {
  it("sends a branded confirmation with the reference, amounts and a status link", async () => {
    m.find.mockResolvedValue(row());
    expect(await sendTravelPaymentEmail("TVL-x")).toEqual({ sent: true });
    const [to, subject, html, brand] = m.send.mock.calls[0];
    expect(to).toBe("ada@example.com");
    expect(subject).toBe("Booking confirmed: Dubai <Escape>");
    expect(html).toContain("TRV-2611-ABCD");
    expect(html).toContain("NGN 60,000");
    expect(html).toContain("Balance remaining:</strong> NGN 140,000"); // voided payments are ignored
    expect(html).toContain("/wander/travel/TVL-x");
    expect(brand).toEqual({ name: "Wander Co" });
  });

  it("escapes agency-entered text in the email body", async () => {
    m.find.mockResolvedValue(row());
    await sendTravelPaymentEmail("TVL-x");
    expect(m.send.mock.calls[0][2]).toContain("Dubai &lt;Escape&gt;");
    expect(m.send.mock.calls[0][2]).not.toContain("<Escape>");
  });

  it("tells the traveller it is not confirmed yet when the trip is still an enquiry (sold out meanwhile)", async () => {
    m.find.mockResolvedValue(row({}, { status: "ENQUIRY" }));
    await sendTravelPaymentEmail("TVL-x");
    expect(m.send.mock.calls[0][1]).toBe("Payment received: Dubai <Escape>");
    expect(m.send.mock.calls[0][2]).toContain("confirming availability");
  });

  it("skips travellers without an email, unsettled payments and other purposes", async () => {
    m.find.mockResolvedValue(row({}, { client: { fullName: "Ada", email: null } }));
    expect((await sendTravelPaymentEmail("TVL-x")).sent).toBe(false);
    m.find.mockResolvedValue(row({ status: "PENDING" }));
    expect((await sendTravelPaymentEmail("TVL-x")).sent).toBe(false);
    m.find.mockResolvedValue(row({ purpose: "ORDER" }));
    expect((await sendTravelPaymentEmail("TVL-x")).sent).toBe(false);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("never throws when the email provider fails", async () => {
    m.find.mockResolvedValue(row());
    m.send.mockRejectedValue(new Error("resend down"));
    expect(await sendTravelPaymentEmail("TVL-x")).toEqual({ sent: false, reason: "send failed" });
    expect(m.logError).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- agency alert
const n = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: n.notify }));

import { classifyTravelPayment, notifyAgencyOfTravelPayment } from "@/lib/payments/travel-confirmation";

const agencyRow = (tripStatus = "CONFIRMED", owner: unknown = { id: "u1", email: "owner@agency.com" }) => ({
  purpose: "TRAVEL_BOOKING", status: "SUCCESSFUL", amount: "60000", currency: "NGN",
  travelTrip: { reference: "TRV-2611-ABCD", title: "Dubai Escape", destination: "Dubai", status: tripStatus, client: { fullName: "Ada <Obi>" }, store: { name: "Wander Co", slug: "wander", business: { user: owner } } },
});

describe("classifyTravelPayment", () => {
  it("flags paid-but-unconfirmed and cancelled trips as needing action", () => {
    expect(classifyTravelPayment("CONFIRMED")).toBe("normal");
    expect(classifyTravelPayment("TICKETED")).toBe("normal");
    expect(classifyTravelPayment("ENQUIRY")).toBe("sold_out");
    expect(classifyTravelPayment("QUOTED")).toBe("sold_out");
    expect(classifyTravelPayment("CANCELLED")).toBe("cancelled");
  });
});

describe("notifyAgencyOfTravelPayment", () => {
  beforeEach(() => { n.notify.mockResolvedValue(undefined); });

  it("notifies the owner in-app and by email about a normal paid booking", async () => {
    m.find.mockResolvedValue(agencyRow());
    expect(await notifyAgencyOfTravelPayment("TVL-x")).toEqual({ notified: true });
    expect(n.notify.mock.calls[0][0]).toMatchObject({ userId: "u1", type: "TRAVEL_PAID", title: "New paid booking: Dubai Escape", url: "/store/wander/admin/travel" });
    const [to, subject, html, sender] = m.send.mock.calls[0];
    expect(to).toBe("owner@agency.com");
    expect(subject).toContain("New paid booking");
    expect(html).toContain("Ada &lt;Obi&gt;");
    expect(sender).toBeUndefined(); // platform-to-merchant mail, like other merchant alerts
  });

  it("raises an action-needed alert with the refund step when the tour was full", async () => {
    m.find.mockResolvedValue(agencyRow("ENQUIRY"));
    await notifyAgencyOfTravelPayment("TVL-x");
    expect(n.notify.mock.calls[0][0].title).toBe("Action needed: paid, but the tour is full");
    expect(m.send.mock.calls[0][1]).toBe("Action needed: paid, but the tour is full");
    expect(m.send.mock.calls[0][2]).toContain("not confirmed");
    expect(m.send.mock.calls[0][2]).toContain("void the payment");
  });

  it("raises an action-needed alert for a payment on a cancelled trip", async () => {
    m.find.mockResolvedValue(agencyRow("CANCELLED"));
    await notifyAgencyOfTravelPayment("TVL-x");
    expect(n.notify.mock.calls[0][0].title).toBe("Action needed: payment on a cancelled trip");
  });

  it("still sends the in-app alert when the owner has no email, and skips ownerless or unsettled payments", async () => {
    m.find.mockResolvedValue(agencyRow("CONFIRMED", { id: "u1", email: null }));
    await notifyAgencyOfTravelPayment("TVL-x");
    expect(n.notify).toHaveBeenCalledTimes(1);
    expect(m.send).not.toHaveBeenCalled();
    m.find.mockResolvedValue(agencyRow("CONFIRMED", null));
    expect((await notifyAgencyOfTravelPayment("TVL-x")).notified).toBe(false);
    m.find.mockResolvedValue({ ...agencyRow(), status: "PENDING" });
    expect((await notifyAgencyOfTravelPayment("TVL-x")).notified).toBe(false);
  });

  it("never throws when notifying fails", async () => {
    m.find.mockRejectedValue(new Error("db down"));
    expect(await notifyAgencyOfTravelPayment("TVL-x")).toEqual({ notified: false, reason: "failed" });
  });
});
