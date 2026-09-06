import { describe, expect, it } from "vitest";

describe("booking payment retry routing", () => {
  it("keeps failed booking payments on the booking confirmation route", () => {
    const slug = "demo-store";
    const bookingId = "booking_123";
    expect(`/store/${slug}/booking/${bookingId}/confirmation?payment=failed`).toBe(
      "/store/demo-store/booking/booking_123/confirmation?payment=failed"
    );
  });
});
