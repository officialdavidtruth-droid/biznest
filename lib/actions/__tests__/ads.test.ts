import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: {
    adCampaign: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    adViewer: { findUnique: vi.fn(), upsert: vi.fn() },
    adReport: { create: vi.fn(), count: vi.fn() },
    product: { findFirst: vi.fn() },
    payment: { update: vi.fn() },
  },
  getViewer: vi.fn(), checkRateLimit: vi.fn(), assertStorePermission: vi.fn(), pending: vi.fn(), failed: vi.fn(), charge: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error { code: string; constructor(msg: string, o: { code: string }) { super(msg); this.code = o.code; } }
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }), cookies: async () => ({ get: () => undefined, set: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit, getClientIp: () => "203.0.113.5" }));
vi.mock("@/lib/browse-viewer", () => ({ getViewer: m.getViewer }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.assertStorePermission }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { email: "owner@example.com" } }) }));
vi.mock("@/lib/payments/pending", () => ({ createPendingPayment: m.pending, markPaymentFailed: m.failed }));
vi.mock("@/lib/payments/gateway", () => ({ chargeCustomer: m.charge, PLATFORM_BILLING_GATEWAY: "KORAPAY", billingCallbackUrl: (kind: string, q?: Record<string, string>) => `https://test.example/api/payments/korapay/${kind}-callback${q ? "?" + new URLSearchParams(q) : ""}` }));
vi.mock("@/lib/constants/app-url", () => ({ APP_URL: "https://app.example.com" }));
vi.mock("nanoid", () => ({ nanoid: () => "nonce123" }));

import { Prisma } from "@prisma/client";
import { recordAdClick, recordAdImpression, reportAd } from "@/lib/actions/ads";
import { createAdCampaign, setAdPaused } from "@/lib/actions/ads-vendor";

const guest = { key: "d:abcdefghijklmnop", userId: null, name: null };
const live = () => ({
  id: "ad1", status: "ACTIVE", impressions: 10, impressionsBought: 100, startsAt: new Date(Date.now() - 3_600_000), endsAt: new Date(Date.now() + 86_400_000),
  store: { business: { user: { id: "owner1" } } },
});
const dup = () => new (Prisma.PrismaClientKnownRequestError as unknown as new (msg: string, o: { code: string }) => Error)("dup", { code: "P2002" });

beforeEach(() => {
  vi.clearAllMocks();
  m.getViewer.mockResolvedValue(guest);
  m.checkRateLimit.mockResolvedValue({ allowed: true });
  m.prisma.adCampaign.findFirst.mockResolvedValue(live());
  m.prisma.adViewer.findUnique.mockResolvedValue(null);
  m.prisma.adViewer.upsert.mockResolvedValue({});
  m.prisma.adCampaign.updateMany.mockResolvedValue({ count: 1 });
});

describe("recordAdImpression", () => {
  it("counts one impression and the viewer's frequency", async () => {
    await recordAdImpression("ad1");
    expect(m.prisma.adViewer.upsert).toHaveBeenCalled();
    expect(m.prisma.adCampaign.updateMany).toHaveBeenCalledWith({ where: { id: "ad1", status: "ACTIVE", impressions: { lt: 100 } }, data: { impressions: { increment: 1 } } });
  });
  it("completes the campaign when the last impression is used", async () => {
    m.prisma.adCampaign.findFirst.mockResolvedValue({ ...live(), impressions: 99 });
    await recordAdImpression("ad1");
    expect(m.prisma.adCampaign.updateMany).toHaveBeenLastCalledWith({ where: { id: "ad1", status: "ACTIVE" }, data: { status: "COMPLETED" } });
  });
  it("does not bill the advertiser looking at their own ad", async () => {
    m.getViewer.mockResolvedValue({ key: "u:owner1xxxxxxxx", userId: "owner1", name: "Owner" });
    await recordAdImpression("ad1");
    expect(m.prisma.adCampaign.updateMany).not.toHaveBeenCalled();
  });
  it("stops at the frequency cap", async () => {
    m.prisma.adViewer.findUnique.mockResolvedValue({ seen: 3, windowStart: new Date() });
    await recordAdImpression("ad1");
    expect(m.prisma.adCampaign.updateMany).not.toHaveBeenCalled();
  });
  it("ignores paused, finished, out-of-date or out-of-budget campaigns", async () => {
    m.prisma.adCampaign.findFirst.mockResolvedValue(null);
    await recordAdImpression("ad1");
    m.prisma.adCampaign.findFirst.mockResolvedValue({ ...live(), endsAt: new Date(Date.now() - 1000) });
    await recordAdImpression("ad1");
    m.prisma.adCampaign.findFirst.mockResolvedValue({ ...live(), impressions: 100 });
    await recordAdImpression("ad1");
    expect(m.prisma.adCampaign.updateMany).not.toHaveBeenCalled();
  });
  it("does nothing when rate-limited", async () => {
    m.checkRateLimit.mockResolvedValue({ allowed: false });
    await recordAdImpression("ad1");
    expect(m.prisma.adCampaign.findFirst).not.toHaveBeenCalled();
  });
});

describe("recordAdClick", () => {
  it("counts a click, but not the owner's", async () => {
    await recordAdClick("ad1");
    expect(m.prisma.adCampaign.update).toHaveBeenCalledWith({ where: { id: "ad1" }, data: { clicks: { increment: 1 } } });
    m.prisma.adCampaign.update.mockClear();
    m.getViewer.mockResolvedValue({ key: "u:owner1xxxxxxxx", userId: "owner1", name: null });
    await recordAdClick("ad1");
    expect(m.prisma.adCampaign.update).not.toHaveBeenCalled();
  });
});

describe("reportAd", () => {
  beforeEach(() => { m.prisma.adReport.create.mockResolvedValue({}); });
  it("pauses an ad after three different people report it", async () => {
    m.prisma.adReport.count.mockResolvedValue(2);
    await reportAd("ad1", "SCAM");
    expect(m.prisma.adCampaign.updateMany).not.toHaveBeenCalled();
    m.prisma.adReport.count.mockResolvedValue(3);
    await reportAd("ad1", "SCAM");
    expect(m.prisma.adCampaign.updateMany).toHaveBeenCalledWith({ where: { id: "ad1", status: "ACTIVE" }, data: { status: "PAUSED", pausedBy: "REPORTS" } });
  });
  it("treats a repeat report as already done and rejects unknown reasons", async () => {
    m.prisma.adReport.create.mockRejectedValue(dup());
    expect((await reportAd("ad1", "SPAM")).success).toBe(true);
    expect((await reportAd("ad1", "WHATEVER")).success).toBe(false);
  });
});

describe("createAdCampaign", () => {
  const input = { placement: "FEED", caption: "Fresh bread", imageUrl: "https://img.example.com/a.jpg", budget: 5000, durationDays: 7 };
  beforeEach(() => {
    m.assertStorePermission.mockResolvedValue({ success: true, store: { id: "s1", slug: "acme-test", status: "ACTIVE" } });
    m.prisma.adCampaign.count.mockResolvedValue(0);
    m.prisma.adCampaign.create.mockResolvedValue({ id: "cmp1" });
    m.prisma.adCampaign.update.mockResolvedValue({});
    m.pending.mockResolvedValue({});
    m.charge.mockResolvedValue({ success: true, authorizationUrl: "https://pay.example.com/x", gateway: "KORAPAY" });
    m.prisma.payment.update.mockResolvedValue({});
    m.prisma.adCampaign.delete.mockResolvedValue({});
  });
  it("creates a pending campaign and returns the checkout link; nothing runs yet", async () => {
    const r = await createAdCampaign("acme-test", input);
    expect(r).toEqual({ success: true, data: { authorizationUrl: "https://pay.example.com/x" } });
    expect(m.prisma.adCampaign.create.mock.calls[0][0].data).toMatchObject({ storeId: "s1", placement: "FEED", budget: 5000, impressionsBought: 3333, durationDays: 7 });
    expect(m.prisma.adCampaign.create.mock.calls[0][0].data.status).toBeUndefined(); // defaults to PENDING_PAYMENT
    expect(m.pending).toHaveBeenCalledWith(expect.objectContaining({ purpose: "AD_CAMPAIGN", reference: "ADS-cmp1-nonce123", amount: 5000, storeId: "s1" }));
    expect(m.charge).toHaveBeenCalledWith(expect.objectContaining({ amountNaira: 5000, callbackUrl: "https://test.example/api/payments/korapay/ad-callback?slug=acme-test" }));
  });
  it("discards the campaign when the gateway refuses", async () => {
    m.charge.mockResolvedValue({ success: false, error: "Gateway down" });
    expect(await createAdCampaign("acme-test", input)).toEqual({ success: false, error: "Gateway down" });
    expect(m.failed).toHaveBeenCalledWith("ADS-cmp1-nonce123");
    expect(m.prisma.adCampaign.delete).toHaveBeenCalledWith({ where: { id: "cmp1" } });
  });
  it("blocks invalid ads, inactive stores, too many open ads and foreign products", async () => {
    expect((await createAdCampaign("acme-test", { ...input, budget: 10 })).success).toBe(false);
    m.prisma.adCampaign.count.mockResolvedValue(5);
    expect((await createAdCampaign("acme-test", input)).success).toBe(false);
    m.prisma.adCampaign.count.mockResolvedValue(0);
    m.prisma.product.findFirst.mockResolvedValue(null);
    expect((await createAdCampaign("acme-test", { ...input, productId: "other" })).success).toBe(false);
    m.assertStorePermission.mockResolvedValue({ success: true, store: { id: "s1", slug: "acme-test", status: "SUSPENDED" } });
    expect((await createAdCampaign("acme-test", input)).success).toBe(false);
    expect(m.charge).not.toHaveBeenCalled();
  });
});

describe("setAdPaused", () => {
  beforeEach(() => { m.assertStorePermission.mockResolvedValue({ success: true, store: { id: "s1", slug: "acme-test", status: "ACTIVE" } }); });
  it("only lets the owner resume what the owner paused", async () => {
    await setAdPaused("acme-test", "ad1", false);
    expect(m.prisma.adCampaign.updateMany).toHaveBeenCalledWith({ where: { id: "ad1", storeId: "s1", status: "PAUSED", pausedBy: "OWNER" }, data: { status: "ACTIVE", pausedBy: null } });
    m.prisma.adCampaign.updateMany.mockResolvedValue({ count: 0 });
    expect((await setAdPaused("acme-test", "ad1", false)).success).toBe(false);
  });
});
