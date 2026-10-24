import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// payout.ts pulls in Prisma; these tests only exercise pure helpers, so stub the DB layer.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@prisma/client", () => ({ Prisma: {} }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import {
  initiateKorapayTransfer,
  initializeKorapayTransaction,
  korapayRefundReference,
  refundKorapayTransaction,
  verifyKorapayTransaction,
  verifyKorapayTransfer,
  verifyKorapayWebhookSignature,
} from "@/lib/payments/korapay";
import { gatewayForPayout } from "@/lib/payments/payout-gateway";
import { classifyTransferStatus } from "@/lib/payments/payout";

const KEY = "sk_test_korapay_secret";
const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
}

beforeEach(() => {
  process.env.KORAPAY_SECRET_KEY = KEY;
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  delete process.env.KORAPAY_SECRET_KEY;
});

describe("webhook signature", () => {
  const data = { amount: 5000, fee: 50, currency: "NGN", status: "success", reference: "ord_1" };
  const sign = (d: unknown, key = KEY) => crypto.createHmac("sha256", key).update(JSON.stringify(d)).digest("hex");

  it("accepts an HMAC of ONLY the data object", () => {
    expect(verifyKorapayWebhookSignature(sign(data), data)).toBe(true);
  });
  it("rejects a tampered payload, wrong key, missing header, or missing key", () => {
    expect(verifyKorapayWebhookSignature(sign(data), { ...data, amount: 1 })).toBe(false);
    expect(verifyKorapayWebhookSignature(sign(data, "other"), data)).toBe(false);
    expect(verifyKorapayWebhookSignature(null, data)).toBe(false);
    delete process.env.KORAPAY_SECRET_KEY;
    expect(verifyKorapayWebhookSignature(sign(data), data)).toBe(false);
  });
  it("rejects signatures of the wrong length without throwing", () => {
    expect(verifyKorapayWebhookSignature("abc", data)).toBe(false);
  });
});

describe("charge init + verify", () => {
  it("sends naira (not kobo), our reference, and the redirect/notification urls", async () => {
    reply({ status: true, message: "ok", data: { reference: "ord_1", checkout_url: "https://checkout.korapay.com/x/pay" } });
    const res = await initializeKorapayTransaction({ email: "a@b.co", amountNaira: 15000.5, reference: "ord_1", callbackUrl: "https://x/cb", notificationUrl: "https://x/wh" });
    expect(res.data?.checkout_url).toContain("korapay");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.korapay.com/merchant/api/v1/charges/initialize");
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ amount: 15000.5, currency: "NGN", reference: "ord_1", redirect_url: "https://x/cb", notification_url: "https://x/wh", merchant_bears_cost: true });
  });

  it("normalises Kora statuses so the settle code can be shared", async () => {
    reply({ status: true, message: "ok", data: { reference: "ord_1", status: "success", amount: "5000.00", amount_paid: "5000.00", currency: "NGN" } });
    const ok = await verifyKorapayTransaction("ord_1");
    expect(ok.data).toMatchObject({ status: "successful", tx_ref: "ord_1", amount: 5000, currency: "NGN" });

    reply({ status: true, message: "ok", data: { reference: "ord_2", status: "processing", amount: "100" } });
    expect((await verifyKorapayTransaction("ord_2")).data?.status).toBe("pending");

    reply({ status: true, message: "ok", data: { reference: "ord_3", status: "failed", amount: "100" } });
    expect((await verifyKorapayTransaction("ord_3")).data?.status).toBe("failed");
  });

  it("reports an error (never a success) when Kora can't be reached or the charge is unknown", async () => {
    reply({ status: false, message: "Charge not found" }, 404);
    expect((await verifyKorapayTransaction("nope")).status).toBe("error");
  });

  it("refuses to call Kora with no key configured", async () => {
    delete process.env.KORAPAY_SECRET_KEY;
    const res = await initializeKorapayTransaction({ email: "a@b.co", amountNaira: 100, reference: "r", callbackUrl: "https://x" });
    expect(res.status).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("refunds", () => {
  it("derives the same refund reference for the same payment+amount (retry can't double refund) and stays <= 50 chars", () => {
    const a = korapayRefundReference("WAL-cuid-0f8fad5b-d9cb-469f-a165-70867728950e", 2500);
    expect(a).toBe(korapayRefundReference("WAL-cuid-0f8fad5b-d9cb-469f-a165-70867728950e", 2500));
    expect(a).not.toBe(korapayRefundReference("WAL-cuid-0f8fad5b-d9cb-469f-a165-70867728950e", 100));
    expect(a.length).toBeLessThanOrEqual(50);
  });
  it("refunds by OUR payment reference", async () => {
    reply({ status: true, message: "ok", data: { refund_reference: "bnr-1", status: "processing" } });
    const res = await refundKorapayTransaction("ord_1", 5000);
    expect(res.data?.refund_reference).toBe("bnr-1");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ payment_reference: "ord_1", amount: 5000 });
    expect(body.reference).toBe(korapayRefundReference("ord_1", 5000));
  });
});

describe("payouts", () => {
  it("sends a bank_account disbursement with our idempotent reference", async () => {
    reply({ status: true, message: "ok", data: { reference: "bnp-abc12", status: "processing" } });
    const res = await initiateKorapayTransfer({ bankCode: "044", accountNumber: "0123456789", amountNaira: 4200, reference: "bnp-abc12", beneficiaryName: "Ada Obi" });
    expect(res.data?.status).toBe("processing");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.korapay.com/merchant/api/v1/transactions/disburse");
    const body = JSON.parse(init.body);
    expect(body.reference).toBe("bnp-abc12");
    expect(body.destination).toMatchObject({ type: "bank_account", amount: 4200, currency: "NGN", bank_account: { bank: "044", account: "0123456789" } });
    expect(body.destination.customer.email).toBeTruthy();
  });
  it("only calls a missing payout notFound on a positive 404", async () => {
    reply({ status: false, message: "Transaction not found" }, 404);
    expect((await verifyKorapayTransfer("bnp-x")).notFound).toBe(true);
    reply({ status: false, message: "Internal error" }, 500);
    expect((await verifyKorapayTransfer("bnp-x")).notFound).toBe(false);
  });
  it("maps Kora payout statuses onto payout outcomes", () => {
    expect(classifyTransferStatus("success")).toBe("PAID");
    expect(classifyTransferStatus("failed")).toBe("FAILED");
    expect(classifyTransferStatus("processing")).toBe("PROCESSING");
  });
  it("routes KORAPAY payments to the Korapay transfer gateway", () => {
    expect(gatewayForPayout("KORAPAY", null)).toBe("KORAPAY");
    expect(gatewayForPayout("WALLET", { transferGateway: "KORAPAY" })).toBe("KORAPAY");
    expect(gatewayForPayout("PAYSTACK", null)).toBe("PAYSTACK");
  });
});
