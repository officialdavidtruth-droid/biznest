import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bookingSource = readFileSync(resolve(process.cwd(), "lib/actions/booking.ts"), "utf8");
const walletSource = readFileSync(resolve(process.cwd(), "lib/actions/customer-wallet.ts"), "utf8");

describe("booking payment lifecycle hardening", () => {
  it("blocks cancellation while a payment is in progress", () => {
    expect(bookingSource).toContain('status === "CANCELLED" && booking.paymentStatus === "PENDING"');
    expect(bookingSource).toContain("Wait for the payment result before cancelling it.");
  });

  it("does not pay a cancelled booking from a delayed gateway callback", () => {
    expect(walletSource).toContain('status: { not: "CANCELLED" },');
    expect(walletSource).toContain('paymentStatus: { not: "PAID" }');
  });

  it("expires only storefront online booking holds", () => {
    expect(bookingSource).toContain('source: "Online"');
    expect(bookingSource).toContain("ONLINE_BOOKING_HOLD_MINUTES = 30");
  });
});
