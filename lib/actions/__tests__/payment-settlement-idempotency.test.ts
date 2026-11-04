import { describe, expect, it } from "vitest";
import fs from "fs";

describe("gateway settlement amount guards", () => {
  it("invoice and quote settlement require verified gateway amount to match the stored Payment", () => {
    const invoice = fs.readFileSync("lib/payments/settle-invoice.ts", "utf8");
    const quote = fs.readFileSync("lib/payments/settle-quote-deposit.ts", "utf8");
    expect(invoice).toContain("amountCoversExpected(Number(verifiedAmountNaira), Number(payment.amount))");
    expect(quote).toContain("amountCoversExpected(Number(verifiedAmountNaira), Number(payment.amount))");
  });

  it("Paystack subscription webhooks bind the verified amount to the stored payment", () => {
    const webhook = fs.readFileSync("app/api/payments/paystack/webhook/route.ts", "utf8");
    expect(webhook).toContain("paymentMatches");
    expect(webhook).toContain("Math.abs(Number(payment.amount) - amountNaira) <= 0.01");
  });

  it("invoice and quote settlement keep payment + business mutation in one transaction", () => {
    const invoice = fs.readFileSync("lib/payments/settle-invoice.ts", "utf8");
    const quote = fs.readFileSync("lib/payments/settle-quote-deposit.ts", "utf8");
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

describe("invoice and quote state guards", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("duplicate or late payments are flagged for review, not silently dropped", () => {
    expect(read("lib/payments/settle-invoice.ts")).toContain("duplicate or late invoice payment");
    expect(read("lib/payments/settle-quote-deposit.ts")).toContain("duplicate or late quote deposit");
  });

  it("only open documents can be paid, accepted or declined", () => {
    expect(read("lib/actions/invoice.ts")).toContain('invoice.status !== "SENT"');
    const quote = read("lib/actions/quote.ts");
    expect(quote).toContain('quote.status !== "SENT"');
    expect(quote).toMatch(/where: \{ id: quoteId, status: "SENT"/);
  });

  it("merchant 'Copy link' uses the tokenised quote link", () => {
    expect(read("components/dashboard/quote-row-actions.tsx")).toContain("getQuoteShareLink");
  });
});

describe("invoice access and ownership guards", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("customer invoice reads need a signed token, the matching customer, or an opt-in legacy link", () => {
    const invoice = read("lib/actions/invoice.ts");
    expect(invoice).toContain('verifyDocToken("invoice", invoiceId, token)');
    expect(invoice).toContain("invoiceTokenRequiredFrom()");
  });

  it("payment callbacks redirect back with the signed token", () => {
    for (const gw of ["paystack", "flutterwave", "korapay"]) {
      expect(read(`app/api/payments/${gw}/callback/route.ts`)).toContain("customerDocUrl(");
    }
  });

  it("merchant-supplied order and customer ids are checked against the store", () => {
    const invoice = read("lib/actions/invoice.ts");
    expect(invoice).toContain("isCustomerOfStore(");
    expect(invoice).toContain("storeId: access.store.id }, select: { id: true } }");
    expect(read("lib/actions/quote.ts")).toContain("isCustomerOfStore(");
  });

  it("marking an invoice paid is a conditional write that can't override cancelled or settled invoices", () => {
    const invoice = read("lib/actions/invoice.ts");
    expect(invoice).toContain('status: { in: ["DRAFT", "SENT"] } }, data: { status: "PAID"');
  });
});
