import { describe, expect, it, vi, beforeEach } from "vitest";

const { store, payment, payout } = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  payment: { findUnique: vi.fn() },
  payout: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { store, payment, payout } }));
vi.mock("@/lib/actions/site-settings", () => ({ getActiveGateway: vi.fn(async () => "PAYSTACK") }));
vi.mock("@prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error { code = "P2002"; } } }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), logEvent: vi.fn() }));

import { chargeCustomer } from "@/lib/payments/gateway";
import { queuePayoutForPayment } from "@/lib/payments/payout";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  process.env.PAYSTACK_SECRET_KEY = "sk_platform";
  process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = "pk_platform";
  process.env.STORE_GATEWAY_ENCRYPTION_KEY = "k";
  fetchMock.mockResolvedValue({ json: async () => ({ status: true, data: { authorization_url: "u", access_code: "a", reference: "r" } }) });
  vi.stubGlobal("fetch", fetchMock);
});

describe("store WITHOUT its own keys behaves as before", () => {
  it("charges with the platform key and public key, not flagged as store gateway", async () => {
    store.findUnique.mockResolvedValue({ ownGatewayEnabled: false, ownGatewayProvider: null });
    const res = await chargeCustomer({ email: "a@b.c", amountNaira: 100, reference: "r", callbackUrl: "cb", storeId: "s1", inline: true });
    expect(res).toMatchObject({ success: true, gateway: "PAYSTACK", usesStoreGateway: false, splitSubaccountCode: null });
    expect((res as any).inline.publicKey).toBe("pk_platform");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer sk_platform");
  });

  it("without a storeId (subscriptions, wallet) never consults store keys", async () => {
    await chargeCustomer({ email: "a@b.c", amountNaira: 100, reference: "r", callbackUrl: "cb", gateway: "PAYSTACK" });
    expect(store.findUnique).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer sk_platform");
  });

  it("still queues a payout for a normal paid payment", async () => {
    payment.findUnique.mockResolvedValue({
      id: "p1", status: "SUCCESSFUL", storeId: "s1", purpose: "ORDER", provider: "PAYSTACK", amount: 100, currency: "NGN",
      usesStoreGateway: false, splitSubaccountCode: null, order: { commission: 0 },
      store: { id: "s1", payoutBankCode: "058", payoutAccountNumber: "123", payoutDetails: null },
    });
    payout.create.mockResolvedValue({});
    const res = await queuePayoutForPayment("ref");
    expect(res.payoutId).toBeTruthy();
    expect(payout.create).toHaveBeenCalledOnce();
  });

  it("skips the payout only for own-gateway payments", async () => {
    payment.findUnique.mockResolvedValue({
      id: "p2", status: "SUCCESSFUL", storeId: "s1", purpose: "ORDER", provider: "PAYSTACK", amount: 100, currency: "NGN",
      usesStoreGateway: true, splitSubaccountCode: null, order: { commission: 0 },
      store: { id: "s1", payoutBankCode: "058", payoutAccountNumber: "123", payoutDetails: null },
    });
    const res = await queuePayoutForPayment("ref2");
    expect(res.skipped).toMatch(/own gateway/);
    expect(payout.create).not.toHaveBeenCalled();
  });
});
