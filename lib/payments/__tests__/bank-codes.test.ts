import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  storeUpdate: vi.fn(),
  flwBanks: vi.fn(),
  flwResolve: vi.fn(),
  psBanks: vi.fn(),
  psResolve: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { store: { update: m.storeUpdate } } }));
vi.mock("@/lib/payments/flutterwave", () => ({ listFlutterwaveBanks: m.flwBanks, resolveFlutterwaveAccount: m.flwResolve }));
vi.mock("@/lib/payments/paystack", () => ({ listPaystackBanks: m.psBanks, resolvePaystackAccount: m.psResolve }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import { accountNamesMatch, candidateBanks, normalizeBankName, resolveBankCodeForGateway } from "@/lib/payments/bank-codes";

const store = (details: object | null, code = "999992") => ({ id: "s1", payoutBankCode: code, payoutAccountNumber: "1234567890", payoutDetails: details });

beforeEach(() => {
  vi.clearAllMocks();
  m.storeUpdate.mockResolvedValue({});
});

describe("name matching", () => {
  it("normalizes noisy bank names", () => {
    expect(normalizeBankName("Guaranty Trust Bank Plc")).toBe(normalizeBankName("Guaranty Trust"));
    expect(normalizeBankName("OPay Digital Services Limited (OPay)")).toBe("opay");
  });
  it("matches account names regardless of order/extras, but not strangers", () => {
    expect(accountNamesMatch("ADA CHIOMA OKAFOR", "OKAFOR ADA CHIOMA")).toBe(true);
    expect(accountNamesMatch("ADA CHIOMA OKAFOR", "ADA OKAFOR")).toBe(true);
    expect(accountNamesMatch("ADA CHIOMA OKAFOR", "JOHN OKON")).toBe(false);
  });
  it("finds Opay under Flutterwave's different listing name via alias", () => {
    const list = [{ name: "Access Bank", code: "044" }, { name: "Paycom", code: "305" }];
    expect(candidateBanks("Opay", list)).toEqual([{ name: "Paycom", code: "305" }]);
  });
});

describe("resolveBankCodeForGateway", () => {
  it("uses the stored code when it was saved through the same gateway (no network)", async () => {
    const r = await resolveBankCodeForGateway(store({ provider: "FLUTTERWAVE", codes: { FLUTTERWAVE: "305" } }, "305"), "FLUTTERWAVE");
    expect(r).toEqual({ code: "305" });
    expect(m.flwBanks).not.toHaveBeenCalled();
  });

  it("prefers a code already recorded for the target gateway", async () => {
    const r = await resolveBankCodeForGateway(store({ provider: "PAYSTACK", codes: { PAYSTACK: "999992", FLUTTERWAVE: "305" } }), "FLUTTERWAVE");
    expect(r).toEqual({ code: "305" });
    expect(m.flwResolve).not.toHaveBeenCalled();
  });

  it("derives the Flutterwave code for a Paystack-connected store, proves it by resolving the name, and saves it", async () => {
    m.flwBanks.mockResolvedValue({ status: true, message: "ok", banks: [{ name: "Access Bank", code: "044" }, { name: "Paycom", code: "305" }] });
    m.flwResolve.mockResolvedValue({ status: "success", message: "ok", data: { account_name: "ADA CHIOMA OKAFOR" } });
    const details = { provider: "PAYSTACK", bankName: "Opay", accountName: "ADA CHIOMA OKAFOR", codes: { PAYSTACK: "999992" } };
    const r = await resolveBankCodeForGateway(store(details), "FLUTTERWAVE");
    expect(r).toEqual({ code: "305" });
    expect(m.flwResolve).toHaveBeenCalledWith("1234567890", "305");
    expect(m.storeUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { payoutDetails: expect.objectContaining({ codes: { PAYSTACK: "999992", FLUTTERWAVE: "305" } }) },
    });
  });

  it("refuses a candidate whose resolved account name belongs to someone else", async () => {
    m.flwBanks.mockResolvedValue({ status: true, message: "ok", banks: [{ name: "Paycom", code: "305" }] });
    m.flwResolve.mockResolvedValue({ status: "success", message: "ok", data: { account_name: "JOHN OKON" } });
    const r = await resolveBankCodeForGateway(store({ provider: "PAYSTACK", bankName: "Opay", accountName: "ADA CHIOMA OKAFOR" }), "FLUTTERWAVE");
    expect("error" in r).toBe(true);
    expect(m.storeUpdate).not.toHaveBeenCalled();
  });

  it("derives the Paystack code for a Flutterwave-connected store (old Paystack payments)", async () => {
    m.psBanks.mockResolvedValue({ status: true, message: "ok", banks: [{ name: "OPay Digital Services Limited (OPay)", code: "999992" }] });
    m.psResolve.mockResolvedValue({ status: true, message: "ok", data: { account_name: "ADA CHIOMA OKAFOR" } });
    const r = await resolveBankCodeForGateway(store({ provider: "FLUTTERWAVE", bankName: "Paycom", accountName: "ADA CHIOMA OKAFOR" }, "305"), "PAYSTACK");
    expect(r).toEqual({ code: "999992" });
  });

  it("asks for a reconnect when there is no bank name to match on", async () => {
    const r = await resolveBankCodeForGateway(store({ provider: "PAYSTACK" }), "FLUTTERWAVE");
    expect("error" in r && r.error).toMatch(/reconnect/i);
  });

  it("does not guess when the bank list can't be loaded", async () => {
    m.flwBanks.mockResolvedValue({ status: false, message: "down", banks: [] });
    const r = await resolveBankCodeForGateway(store({ provider: "PAYSTACK", bankName: "Opay" }), "FLUTTERWAVE");
    expect("error" in r).toBe(true);
  });
});
