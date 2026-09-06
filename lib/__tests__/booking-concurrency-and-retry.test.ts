import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("booking concurrency and payment retry regressions", () => {
  const booking = readFileSync(resolve(process.cwd(), "lib/actions/booking.ts"), "utf8");
  const widget = readFileSync(resolve(process.cwd(), "components/storefront/booking-widget.tsx"), "utf8");
  const wizard = readFileSync(resolve(process.cwd(), "components/storefront/templates/booking-flow-wizard.tsx"), "utf8");
  const hotel = readFileSync(resolve(process.cwd(), "components/storefront/hotel-reservation-form.tsx"), "utf8");
  const photo = readFileSync(resolve(process.cwd(), "components/storefront/photography-booking-client.tsx"), "utf8");

  it("creates appointment bookings inside a serializable transaction", () => {
    expect(booking).toContain('prisma.$transaction(async (tx) => {');
    expect(booking).toContain('}, { isolationLevel: "Serializable" });');
    expect(booking).toContain('if (message === "SLOT_TAKEN")');
    expect(booking).toContain('if (message === "DUPLICATE_BOOKING")');
  });

  it("routes payment-initiation failures to the booking confirmation retry screen", () => {
    for (const source of [widget, wizard, hotel, photo]) {
      expect(source).toContain('/booking/');
      expect(source).toContain('/confirmation?payment=failed');
    }
  });
});
