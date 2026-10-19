import { beforeEach, describe, expect, it, vi } from "vitest";

// Pure unit test: everything the action talks to is mocked, no database needed.
const mocks = vi.hoisted(() => ({
  assertStoreAccess: vi.fn(),
  findFirst: vi.fn(),
  createNotification: vi.fn(),
  sendAbandonedCheckoutEmail: vi.fn(),
  sendWhatsAppMessage: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actions/order", () => ({ assertStoreAccess: mocks.assertStoreAccess }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findFirst: mocks.findFirst },
    abandonedCheckoutNotification: { create: mocks.createNotification },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendAbandonedCheckoutEmail: mocks.sendAbandonedCheckoutEmail }));
vi.mock("@/lib/store-url", () => ({ buildStoreUrl: (s: { slug: string }, path: string) => `https://app.test/${s.slug}${path}` }));
vi.mock("@/lib/whatsapp/send", () => ({ sendWhatsAppMessage: mocks.sendWhatsAppMessage }));

import { sendAbandonedCheckoutRecovery } from "@/lib/actions/abandoned-checkout";

const order = {
  id: "o1",
  buyer: { name: "Destiny", email: "buyer@example.com" },
  currency: "NGN",
  total: 5000,
  items: [{ quantity: 1, unitPrice: 5000, product: { name: "Lol", images: [] }, service: null, variant: null }],
  shippingAddress: { fullName: "Destiny Sidi", phone: "+2348000000000" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertStoreAccess.mockResolvedValue({ success: true, store: { id: "s1", name: "Velox Space", slug: "velox-space", logoUrl: null, themeColors: { primary: "#7c3aed" }, contactEmail: "hello@velox.test", contactPhone: null } });
  mocks.findFirst.mockResolvedValue(order);
});

describe("sendAbandonedCheckoutRecovery", () => {
  it("records SENT when the email provider accepts the message", async () => {
    mocks.sendAbandonedCheckoutEmail.mockResolvedValue({ data: { id: "em_1" }, error: null });
    const r = await sendAbandonedCheckoutRecovery("velox-space", "o1", "EMAIL");
    expect(r.success).toBe(true);
    expect(mocks.createNotification).toHaveBeenCalledWith({ data: expect.objectContaining({ channel: "EMAIL", status: "SENT", error: null }) });
  });

  it("sends the email as the store the customer shopped with, not as BizNest", async () => {
    mocks.sendAbandonedCheckoutEmail.mockResolvedValue({ data: { id: "em_1" }, error: null });
    await sendAbandonedCheckoutRecovery("velox-space", "o1", "EMAIL");
    expect(mocks.sendAbandonedCheckoutEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "buyer@example.com",
        cartUrl: "https://app.test/velox-space/cart",
        store: expect.objectContaining({ name: "Velox Space", primaryColor: "#7c3aed", contactEmail: "hello@velox.test" }),
        items: [expect.objectContaining({ name: "Lol", quantity: 1, unitPrice: 5000 })],
      })
    );
  });

  it("records FAILED when the provider resolves with an error (it does not throw)", async () => {
    mocks.sendAbandonedCheckoutEmail.mockResolvedValue({ data: null, error: { name: "validation_error", message: "The biznest.space domain is not verified." } });
    const r = await sendAbandonedCheckoutRecovery("velox-space", "o1", "EMAIL");
    expect(r.success).toBe(false);
    expect(mocks.createNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: "EMAIL", status: "FAILED", error: "The biznest.space domain is not verified." }),
    });
    // the merchant gets a plain message, not the provider's internals
    expect(r).toEqual({ success: false, error: expect.not.stringContaining("biznest.space") });
  });

  it("records FAILED when the email call throws", async () => {
    mocks.sendAbandonedCheckoutEmail.mockRejectedValue(new Error("network down"));
    const r = await sendAbandonedCheckoutRecovery("velox-space", "o1", "EMAIL");
    expect(r.success).toBe(false);
    expect(mocks.createNotification).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "FAILED", error: "network down" }) });
  });

  it("no longer supports SMS: rejected before anything is sent or recorded", async () => {
    // @ts-expect-error SMS is no longer a valid recovery channel
    const r = await sendAbandonedCheckoutRecovery("velox-space", "o1", "SMS");
    expect(r.success).toBe(false);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.sendAbandonedCheckoutEmail).not.toHaveBeenCalled();
    expect(mocks.sendWhatsAppMessage).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("still sends WhatsApp", async () => {
    mocks.sendWhatsAppMessage.mockResolvedValue({ success: true });
    const r = await sendAbandonedCheckoutRecovery("velox-space", "o1", "WHATSAPP");
    expect(r.success).toBe(true);
    expect(mocks.createNotification).toHaveBeenCalledWith({ data: expect.objectContaining({ channel: "WHATSAPP", status: "SENT" }) });
  });
});
