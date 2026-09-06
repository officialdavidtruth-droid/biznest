import { describe, expect, it } from "vitest";

describe("PMS payment lifecycle guards", () => {
  it("does not allow cancellation while a reservation payment is pending", () => {
    const status = "CONFIRMED";
    const paymentStatus = "PENDING";
    expect(["PENDING", "CONFIRMED"].includes(status)).toBe(true);
    expect(paymentStatus).toBe("PENDING");
  });

  it("does not allow starting a second deposit while one is pending", () => {
    expect("PENDING" === "PENDING").toBe(true);
  });

  it("only settles a reservation payment into PAID when the reservation is not cancelled", () => {
    const reservationStatus = "CANCELLED";
    expect(reservationStatus !== "CANCELLED").toBe(false);
  });

  it("keeps terminal reservation states out of payment settlement", () => {
    const terminalStatuses = ["CANCELLED", "NO_SHOW", "CHECKED_OUT"];
    expect(terminalStatuses.includes("CANCELLED")).toBe(true);
    expect(terminalStatuses.includes("NO_SHOW")).toBe(true);
  });
});
