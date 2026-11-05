import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  wa: vi.fn(),
  sms: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/whatsapp/send", () => ({ sendWhatsAppMessage: m.wa }));
vi.mock("@/lib/sms/send", () => ({ sendSms: m.sms }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), errorMeta: () => ({}) }));

import { messageCustomer } from "@/lib/customer-messaging";

const base = { phone: "0803 123 4567", firstName: "Ada Obi", storeName: "Zara Fabrics", text: "Your order\nis ready.", dedupeKey: "order:1" };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.WHATSAPP_CUSTOMER_TEMPLATE;
  m.rate.mockResolvedValue({ allowed: true });
  m.wa.mockResolvedValue({ success: true });
  m.sms.mockResolvedValue({ success: true });
});

describe("messageCustomer", () => {
  it("sends on WhatsApp first, to the normalised international number", async () => {
    const out = await messageCustomer(base);
    expect(out).toEqual({ sent: true, channel: "WHATSAPP" });
    expect(m.wa).toHaveBeenCalledWith("2348031234567", { body: "Hi Ada, Your order is ready." });
    expect(m.sms).not.toHaveBeenCalled();
  });

  it("uses the approved template (3 variables, one line) when configured", async () => {
    process.env.WHATSAPP_CUSTOMER_TEMPLATE = "customer_update";
    await messageCustomer(base);
    expect(m.wa).toHaveBeenCalledWith("2348031234567", { templateName: "customer_update", templateParams: ["Ada", "Zara Fabrics", "Your order is ready."] });
  });

  it("falls back to SMS, prefixed with the store name", async () => {
    m.wa.mockResolvedValue({ success: false, error: "template not approved" });
    const out = await messageCustomer(base);
    expect(out).toEqual({ sent: true, channel: "SMS" });
    expect(m.sms).toHaveBeenCalledWith("2348031234567", "Zara Fabrics: Your order is ready.");
  });

  it("reports not_configured when neither provider is set up, and failed otherwise", async () => {
    m.wa.mockResolvedValue({ success: false, error: "WhatsApp is not configured for this platform yet." });
    m.sms.mockResolvedValue({ success: false, error: "SMS is not configured for this platform yet." });
    expect(await messageCustomer(base)).toEqual({ sent: false, reason: "not_configured" });

    m.sms.mockResolvedValue({ success: false, error: "insufficient balance" });
    expect(await messageCustomer(base)).toEqual({ sent: false, reason: "failed", detail: "insufficient balance" });
  });

  it("does nothing without a usable phone, and never when throttled", async () => {
    expect(await messageCustomer({ ...base, phone: null })).toEqual({ sent: false, reason: "no_phone" });
    expect(await messageCustomer({ ...base, phone: "12" })).toEqual({ sent: false, reason: "bad_phone" });
    m.rate.mockResolvedValue({ allowed: false });
    expect(await messageCustomer(base)).toEqual({ sent: false, reason: "throttled" });
    expect(m.wa).not.toHaveBeenCalled();
    expect(m.sms).not.toHaveBeenCalled();
  });
});
