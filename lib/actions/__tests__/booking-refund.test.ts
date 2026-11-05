import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("booking refund lifecycle", () => {
  const refund = readFileSync(resolve(process.cwd(), "lib/actions/refund.ts"), "utf8");
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

  it("requires cancelled + paid bookings before refunding", () => {
    expect(refund).toContain('booking.status !== "CANCELLED"');
    expect(refund).toContain('booking.paymentStatus !== "PAID"');
  });

  it("supports wallet refunds without issuing a gateway refund", () => {
    expect(refund).toContain('payment.provider === "WALLET"');
    expect(refund).toContain('balance: { increment: payment.amount }');
    expect(refund).toContain('type: "REFUND"');
  });

  it("refunds wallet-paid ORDERS back into the wallet, never to a gateway", () => {
    const orderRefund = refund.slice(refund.indexOf("export async function issueRefund("), refund.indexOf("Refund clawback ledger"));
    const walletBranch = orderRefund.indexOf('payment.provider === "WALLET"');
    expect(walletBranch).toBeGreaterThan(-1);
    // The wallet branch must come before the gateway call so a wallet payment can never reach refundPayment().
    expect(walletBranch).toBeLessThan(orderRefund.indexOf("refundPayment("));
    const branch = orderRefund.slice(walletBranch, orderRefund.indexOf("refundPayment("));
    expect(branch).toContain("balance: { increment: payment.amount }");
    expect(branch).toContain("orderId: order.id");
    expect(branch).toContain("recordPayoutRefundEffect(tx, payment.id)");
    expect(branch).toContain('isolationLevel: "Serializable"');
  });

  it("records gateway refunds idempotently", () => {
    expect(refund).toContain('status: "REFUNDED"');
    expect(refund).toContain('where: { id: payment.id, status: "SUCCESSFUL" }');
    expect(refund).toContain("refundReference: refund.refundReference");
  });

  it("adds REFUNDED to PMS payment state", () => {
    expect(schema).toMatch(/enum PropertyPaymentStatus \{[\s\S]*?PAID[\s\S]*?REFUNDED[\s\S]*?\}/);
  });

  it("keeps vendor payouts consistent with every refund path", () => {
    // Defined once, then used by the order, reconcile, wallet-booking, gateway-booking and reservation refunds.
    expect(refund).toContain("async function recordPayoutRefundEffect");
    expect((refund.match(/recordPayoutRefundEffect\(tx, payment\.id\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    // Unsent payouts are cancelled; sent/in-flight ones become a clawback owed by the store.
    expect(refund).toContain('where: { id: payout.id, status: { in: ["QUEUED", "HELD"] } }');
    expect(refund).toContain('status === "PAID" || status === "PROCESSING"');
    expect(refund).toContain("refundClawbackOwed: { increment: amount }");
  });
});
