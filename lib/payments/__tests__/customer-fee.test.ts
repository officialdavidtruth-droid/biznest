import { afterEach, describe, expect, it } from "vitest";
import { feeSchedule, feeConfigFor, gatewayFeeOn, grossUpForGatewayFee, payoutTransferFee, transferFeeConfigFor } from "@/lib/payments/customer-fee";
import { vendorPayoutAmount } from "@/lib/payments/gateway-fee";

afterEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith("GATEWAY_FEE_") || k.startsWith("PAYOUT_TRANSFER_FEE") || k === "CUSTOMER_PAYS_GATEWAY_FEE" || k === "CUSTOMER_PAYS_TRANSFER_FEE") delete process.env[k];
});

/** After the gateway keeps its fee out of what the customer paid, at least the price must be left. */
function leftAfterFee(gw: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY", price: number) {
  const { totalNaira } = grossUpForGatewayFee(gw, price);
  return { totalNaira, left: totalNaira - gatewayFeeOn(totalNaira, feeSchedule(gw)) };
}

describe("grossUpForGatewayFee", () => {
  it("leaves the full price after the fee, for every gateway and a spread of prices", () => {
    for (const gw of ["PAYSTACK", "FLUTTERWAVE", "KORAPAY"] as const) {
      for (const price of [100, 1000, 2400, 2499, 2500, 2501, 3000, 9999.99, 15000, 50000, 133000, 140000, 500000, 2500000]) {
        const { left } = leftAfterFee(gw, price);
        expect(left).toBeGreaterThanOrEqual(price - 0.005);
        expect(left).toBeLessThan(price + 0.5); // never wildly over-charges
      }
    }
  });
  it("matches hand-worked figures", () => {
    // Flutterwave 2% (1.4% + 0.6% platform fee): price 10,000 -> 10,000 / 0.98 = 10,204.09 (fee 204.09)
    expect(grossUpForGatewayFee("FLUTTERWAVE", 10000)).toEqual({ totalNaira: 10204.09, feeNaira: 204.09 });
    // Paystack 1.5% + 100: (10,000 + 100) / 0.985 = 10,253.81
    expect(grossUpForGatewayFee("PAYSTACK", 10000).totalNaira).toBe(10253.81);
  });
  it("uses the cap on large amounts: customer pays price + cap", () => {
    expect(grossUpForGatewayFee("FLUTTERWAVE", 500000)).toEqual({ totalNaira: 502000, feeNaira: 2000 });
    expect(grossUpForGatewayFee("PAYSTACK", 500000)).toEqual({ totalNaira: 502000, feeNaira: 2000 });
  });
  it("Paystack waives the flat fee on small charges", () => {
    // 2,000 / 0.985 = 2,030.46 which is under 2,500, so no flat 100
    expect(grossUpForGatewayFee("PAYSTACK", 2000).totalNaira).toBe(2030.46);
  });
  it("adds nothing for zero or invalid prices, or when switched off", () => {
    expect(grossUpForGatewayFee("PAYSTACK", 0)).toEqual({ totalNaira: 0, feeNaira: 0 });
    expect(grossUpForGatewayFee("PAYSTACK", Number.NaN).feeNaira).toBe(0);
    process.env.CUSTOMER_PAYS_GATEWAY_FEE = "false";
    expect(grossUpForGatewayFee("FLUTTERWAVE", 10000)).toEqual({ totalNaira: 10000, feeNaira: 0 });
  });
  it("environment overrides change the rate (negotiated pricing, VAT)", () => {
    process.env.GATEWAY_FEE_FLUTTERWAVE_PERCENT = "1.4";
    expect(grossUpForGatewayFee("FLUTTERWAVE", 10000).totalNaira).toBe(10141.99);
    process.env.GATEWAY_FEE_VAT_PERCENT = "7.5";
    const { left } = leftAfterFee("FLUTTERWAVE", 10000);
    expect(left).toBeGreaterThanOrEqual(9999.995);
  });
});

describe("vendor payout when the customer covered the fee", () => {
  it("pays the vendor the full price", () => {
    // customer charged 10,141.99; Flutterwave kept its fee
    const raw = { data: { amount: 10141.99, app_fee: 141.99 } };
    expect(vendorPayoutAmount("FLUTTERWAVE", raw, 10000, 0, 10000)).toEqual({ amount: 10000, feeAmount: 0 });
  });
  it("still pays the full price if the real fee ended up a little above the estimate", () => {
    const raw = { data: { amount: 10141.99, app_fee: 150 } };
    expect(vendorPayoutAmount("FLUTTERWAVE", raw, 10000, 0, 10000).amount).toBe(10000);
  });
  it("Paystack kobo shape", () => {
    const raw = { data: { amount: 1025381, fees: 15381 } };
    expect(vendorPayoutAmount("PAYSTACK", raw, 10000, 0, 10000).amount).toBe(10000);
  });
  it("older payments with no fee added keep the old rule", () => {
    expect(vendorPayoutAmount("KORAPAY", { data: { amount: 10000, raw: { fee: 150 } } }, 10000, 0, 10000)).toEqual({ amount: 9850, feeAmount: 150 });
  });
});

describe("payout transfer fee paid by the customer", () => {
  it("follows the published tiers (Paystack has no VAT by default)", () => {
    const cfg = transferFeeConfigFor("PAYSTACK");
    expect(payoutTransferFee(100, cfg)).toBe(10);
    expect(payoutTransferFee(5000, cfg)).toBe(10);
    expect(payoutTransferFee(5001, cfg)).toBe(25);
    expect(payoutTransferFee(50000, cfg)).toBe(25);
    expect(payoutTransferFee(50001, cfg)).toBe(50);
  });
  it("adds 7.5% VAT for Flutterwave", () => {
    const cfg = transferFeeConfigFor("FLUTTERWAVE");
    expect(payoutTransferFee(100, cfg)).toBe(10.75);
    expect(payoutTransferFee(100000, cfg)).toBe(53.75);
  });
  it("can be replaced by a fixed amount or switched off", () => {
    process.env.PAYOUT_TRANSFER_FEE_NAIRA = "30";
    expect(payoutTransferFee(100, transferFeeConfigFor("FLUTTERWAVE"))).toBe(30);
    expect(payoutTransferFee(100, transferFeeConfigFor("FLUTTERWAVE", false))).toBe(0);
    delete process.env.PAYOUT_TRANSFER_FEE_NAIRA;
    process.env.CUSTOMER_PAYS_TRANSFER_FEE = "false";
    expect(feeConfigFor("FLUTTERWAVE").transfer.enabled).toBe(false);
  });
  it("is off for a store collecting into its own gateway account", () => {
    expect(feeConfigFor("FLUTTERWAVE", false).transfer.enabled).toBe(false);
    expect(payoutTransferFee(5000, feeConfigFor("FLUTTERWAVE", false).transfer)).toBe(0);
  });
  it("is grossed up like the rest, so the platform keeps price + transfer fee after the gateway's cut", () => {
    const transfer = payoutTransferFee(100, transferFeeConfigFor("FLUTTERWAVE"));
    const { totalNaira, feeNaira } = grossUpForGatewayFee("FLUTTERWAVE", 100, undefined, undefined, undefined, transfer);
    expect(feeNaira).toBeCloseTo(totalNaira - 100, 2);
    expect(totalNaira - gatewayFeeOn(totalNaira, feeSchedule("FLUTTERWAVE"))).toBeGreaterThanOrEqual(100 + transfer - 0.005);
  });
  it("a customer-covered payment pays the vendor the full price even if a flat transfer fee is configured", () => {
    process.env.PAYOUT_TRANSFER_FEE_NAIRA = "50";
    const raw = { data: { amount: 113.01, app_fee: 2.26 } };
    expect(vendorPayoutAmount("FLUTTERWAVE", raw, 100, 0, 100)).toEqual({ amount: 100, feeAmount: 0 });
  });
});
