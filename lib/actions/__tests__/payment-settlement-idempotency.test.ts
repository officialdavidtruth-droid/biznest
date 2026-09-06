import { describe, expect, it } from "vitest";
import fs from "fs";

describe("gateway settlement amount guards", () => {
  it("invoice and quote settlement require verified gateway amount to match the stored Payment", () => {
    const invoice = fs.readFileSync("lib/actions/invoice.ts", "utf8");
    const quote = fs.readFileSync("lib/actions/quote.ts", "utf8");
    expect(invoice).toContain("Math.abs(Number(payment.amount) - Number(verifiedAmountNaira)) > 0.01");
    expect(quote).toContain("Math.abs(Number(payment.amount) - Number(verifiedAmountNaira)) > 0.01");
  });

  it("Paystack subscription webhooks bind the verified amount to the stored payment", () => {
    const webhook = fs.readFileSync("app/api/payments/paystack/webhook/route.ts", "utf8");
    expect(webhook).toContain("paymentMatches");
    expect(webhook).toContain("Math.abs(Number(payment.amount) - amountNaira) <= 0.01");
  });

  it("invoice and quote settlement keep payment + business mutation in one transaction", () => {
    const invoice = fs.readFileSync("lib/actions/invoice.ts", "utf8");
    const quote = fs.readFileSync("lib/actions/quote.ts", "utf8");
    expect(invoice).toContain("await prisma.$transaction(async (tx) => {");
    expect(quote).toContain("await prisma.$transaction(async (tx) => {");
    expect(quote).toContain("paymentProvider: payment.provider");
  });

  it("settlement paths pass provider-verified amounts", () => {
    const paystack = fs.readFileSync("app/api/payments/paystack/webhook/route.ts", "utf8");
    const flutterwave = fs.readFileSync("app/api/payments/flutterwave/webhook/route.ts", "utf8");
    expect(paystack).toContain("settleInvoicePayment(reference, Number(verification.data?.amount ?? 0) / 100");
    expect(flutterwave).toContain("settleInvoicePayment(txRef, Number(verification.data?.amount ?? 0)");
  });
});
