import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Reference-template home components render on live merchant stores, so they must never invent
// social proof. containsDemoClaim only covers theme copy; this guards the component source too.
const FILES = ["components/storefront/hotel-reference-homes.tsx"];
// Shipping promises belong to the merchant, so no template may hard-code them.
const SHIPPING_FILES = ["lib/template-themes.ts"];
const FORBIDDEN: [RegExp, string][] = [
  [/Math\.max\([^)]*completedOrders\s*,\s*\d{2,}/, "floors a real count with a made-up number"],
  [/Verified (customer|guest)/i, "invented reviewer attribution"],
  [/Agoda|Tripadvisor|Booking\.com/, "third-party review-site ratings"],
  [/Best Price Guarantee/i, "unverifiable guarantee"],
  [/\b(5|Five)-Star\b/i, "unverifiable star rating"],
  [/24\/7/, "unverifiable availability claim"],
  [/(thousands|millions) of happy/i, "invented customer numbers"],
  [/\bSINCE \{new Date/, "invented founding year"],
  [/"\$\d[\d,]*"/, "hard-coded dollar sample price"],
];

describe("template sources make no shipping promises or hard-coded USD prices", () => {
  for (const file of SHIPPING_FILES) {
    const src = readFileSync(resolve(process.cwd(), file), "utf8");
    it(`${file}: no free shipping/delivery claim`, () => expect(src).not.toMatch(/free\s+(shipping|delivery)/i));
  }
});

describe("reference template components contain no invented claims", () => {
  for (const file of FILES) {
    const src = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const [re, why] of FORBIDDEN) it(`${file}: no ${why}`, () => expect(src).not.toMatch(re));
  }
});