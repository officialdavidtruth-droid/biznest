import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  listPaystackBanks: vi.fn(),
  resolvePaystackAccount: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { store: { findUnique: m.findUnique, updateMany: m.updateMany } } }));
vi.mock("@/lib/payments/paystack", () => ({ listPaystackBanks: m.listPaystackBanks, resolvePaystackAccount: m.resolvePaystackAccount }));
vi.mock("@/lib/payments/flutterwave", () => ({ listFlutterwaveBanks: vi.fn(), resolveFlutterwaveAccount: vi.fn() }));
vi.mock("@/lib/payments/korapay", () => ({ listKorapayBanks: vi.fn(), resolveKorapayAccount: vi.fn() }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import { adoptManualBankForPayout } from "../payout-from-manual";

const store = { id: "s1", payoutBankCode: null, payoutAccountNumber: null, manualBankName: "OPay", manualAccountName: "DESTINY SIDI", manualAccountNumber: "7019429664" };

beforeEach(() => {
  vi.clearAllMocks();
  m.findUnique.mockResolvedValue(store);
  m.listPaystackBanks.mockResolvedValue({ status: true, banks: [{ name: "Access Bank", code: "044" }, { name: "OPay Digital Services Limited", code: "999992" }] });
  m.resolvePaystackAccount.mockResolvedValue({ status: true, data: { account_name: "SIDI DESTINY OLUWA" } });
  m.updateMany.mockResolvedValue({ count: 1 });
});

describe("adoptManualBankForPayout", () => {
  it("connects the bank-transfer account once the bank confirms the holder name", async () => {
    const r = await adoptManualBankForPayout("s1", "PAYSTACK");
    expect(r).toEqual({ ok: true, alreadyConnected: false });
    expect(m.resolvePaystackAccount).toHaveBeenCalledWith("7019429664", "999992");
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "s1", payoutBankCode: null }, data: expect.objectContaining({ payoutBankCode: "999992", payoutAccountNumber: "7019429664" }) }));
  });

  it("refuses when the bank returns a different name (never sends money to an unverified account)", async () => {
    m.resolvePaystackAccount.mockResolvedValue({ status: true, data: { account_name: "JOHN SMITH" } });
    expect(await adoptManualBankForPayout("s1", "PAYSTACK")).toMatchObject({ ok: false });
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("refuses incomplete details and invalid account numbers", async () => {
    m.findUnique.mockResolvedValue({ ...store, manualAccountNumber: "123" });
    expect(await adoptManualBankForPayout("s1", "PAYSTACK")).toMatchObject({ ok: false });
    m.findUnique.mockResolvedValue({ ...store, manualBankName: null });
    expect(await adoptManualBankForPayout("s1", "PAYSTACK")).toMatchObject({ ok: false });
    expect(m.listPaystackBanks).not.toHaveBeenCalled();
  });

  it("never replaces an existing payout account", async () => {
    m.findUnique.mockResolvedValue({ ...store, payoutBankCode: "058", payoutAccountNumber: "0123456789" });
    expect(await adoptManualBankForPayout("s1", "PAYSTACK")).toEqual({ ok: true, alreadyConnected: true });
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("fails safely when the gateway is down", async () => {
    m.listPaystackBanks.mockRejectedValue(new Error("boom"));
    expect(await adoptManualBankForPayout("s1", "PAYSTACK")).toMatchObject({ ok: false });
  });
});
