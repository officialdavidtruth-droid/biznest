import { afterEach, describe, expect, it } from "vitest";
import { extractGatewayFeeNaira, vendorPayoutAmount } from "@/lib/payments/gateway-fee";

afterEach(() => {
  delete process.env.PAYOUT_TRANSFER_FEE_NAIRA;
  delete process.env.GATEWAY_FEE_FALLBACK_PERCENT;
});

describe("extractGatewayFeeNaira", () => {
  it("reads Korapay fee + vat from the stored verify response", () => {
    expect(extractGatewayFeeNaira("KORAPAY", { status: "success", data: { raw: { fee: "150.5", vat: 11.25 } } })).toBe(161.75);
  });
  it("reads the Flutterwave app_fee", () => {
    expect(extractGatewayFeeNaira("FLUTTERWAVE", { data: { app_fee: 140 } })).toBe(140);
  });
  it("converts the Paystack fee from kobo", () => {
    expect(extractGatewayFeeNaira("PAYSTACK", { data: { fees: 25000 } })).toBe(250);
  });
  it("returns 0 for missing or odd payloads", () => {
    expect(extractGatewayFeeNaira("KORAPAY", null)).toBe(0);
    expect(extractGatewayFeeNaira("KORAPAY", { data: {} })).toBe(0);
    expect(extractGatewayFeeNaira("WALLET", { data: { fee: 5 } })).toBe(0);
  });
});

describe("vendorPayoutAmount", () => {
  it("holds the real gateway fee back from the vendor", () => {
    expect(vendorPayoutAmount("KORAPAY", { data: { raw: { fee: 150 } } }, 10000)).toEqual({ amount: 9850, feeAmount: 150 });
  });
  it("also passes the flat transfer fee on", () => {
    process.env.PAYOUT_TRANSFER_FEE_NAIRA = "50";
    expect(vendorPayoutAmount("KORAPAY", { data: { raw: { fee: 150 } } }, 10000)).toEqual({ amount: 9800, feeAmount: 200 });
  });
  it("uses the fallback percent only when the payload has no fee", () => {
    process.env.GATEWAY_FEE_FALLBACK_PERCENT = "1.5";
    expect(vendorPayoutAmount("FLUTTERWAVE", {}, 10000)).toEqual({ amount: 9850, feeAmount: 150 });
    expect(vendorPayoutAmount("FLUTTERWAVE", { data: { app_fee: 100 } }, 10000)).toEqual({ amount: 9900, feeAmount: 100 });
  });
  it("pays in full when no fee is known, and never goes negative", () => {
    expect(vendorPayoutAmount("KORAPAY", {}, 10000)).toEqual({ amount: 10000, feeAmount: 0 });
    expect(vendorPayoutAmount("KORAPAY", { data: { raw: { fee: 500 } } }, 300)).toEqual({ amount: 0, feeAmount: 300 });
  });
});
