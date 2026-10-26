import { describe, expect, it } from "vitest";
import {
  buildChecklist,
  countRealListings,
  getStarterIdeas,
  isPlaceholderListingName,
  mergeChecklistMeta,
  readChecklistMeta,
  LISTINGS_TARGET,
} from "@/lib/onboarding-checklist";
import { SAMPLE_LISTINGS } from "@/lib/sample-listings";

const base = {
  logoUrl: null,
  realListingCount: 0,
  hasBankPayout: false,
  needsPayoutReconnect: false,
  linkShared: false,
  category: "Fashion" as const,
  sellsProducts: true,
  offersServices: false,
};

describe("placeholder listings", () => {
  it("treats every auto-seeded sample as a placeholder, case-insensitively", () => {
    for (const sample of Object.values(SAMPLE_LISTINGS).flat()) {
      expect(isPlaceholderListingName(sample.name)).toBe(true);
      expect(isPlaceholderListingName(`  ${sample.name.toUpperCase()} `)).toBe(true);
    }
  });

  it("counts only non-placeholder listings", () => {
    expect(countRealListings(["Ankara Two-Piece Set", "Everyday Tote Bag"])).toBe(0);
    expect(countRealListings(["Ankara Two-Piece Set", "My Own Dress", "Another Dress"])).toBe(2);
  });
});

describe("buildChecklist", () => {
  it("starts at 0/4 for a brand-new store and lists steps in the agreed order", () => {
    const c = buildChecklist(base);
    expect(c.steps.map((s) => s.id)).toEqual(["logo", "listings", "payout", "share"]);
    expect(c.doneCount).toBe(0);
    expect(c.complete).toBe(false);
  });

  it("completes only when all four steps are done", () => {
    const c = buildChecklist({ ...base, logoUrl: "https://x/logo.png", realListingCount: LISTINGS_TARGET, hasBankPayout: true, linkShared: true });
    expect(c.complete).toBe(true);
    expect(c.doneCount).toBe(4);
  });

  it("requires 3 real listings, and caps the progress text", () => {
    expect(buildChecklist({ ...base, realListingCount: 2 }).steps[1].done).toBe(false);
    const done = buildChecklist({ ...base, realListingCount: 9 }).steps[1];
    expect(done.done).toBe(true);
    expect(done.description).toContain("3 of 3");
  });

  it("uses business-appropriate wording and destinations", () => {
    expect(buildChecklist({ ...base, category: "Restaurant" }).steps[1].title).toBe("Add 3 menu items");
    const salon = buildChecklist({ ...base, category: "Salon", sellsProducts: false, offersServices: true }).steps[1];
    expect(salon.title).toBe("Add 3 services");
    expect(salon.href).toBe("/services/new");
    const hotel = buildChecklist({ ...base, category: "Hotel & Lodging" }).steps[1];
    expect(hotel.title).toBe("Add 3 rooms");
    expect(hotel.href).toBe("/pms");
    expect(hotel.hardLink).toBe(true);
  });

  it("asks legacy-subaccount stores to reconnect instead of 'connect'", () => {
    const step = buildChecklist({ ...base, needsPayoutReconnect: true }).steps[2];
    expect(step.title).toMatch(/Reconnect/);
    expect(step.done).toBe(false);
  });
});

describe("checklist metadata", () => {
  it("reads safely from null, arrays and junk", () => {
    const empty = { linkSharedAt: null, dismissedAt: null };
    expect(readChecklistMeta(null)).toEqual(empty);
    expect(readChecklistMeta([])).toEqual(empty);
    expect(readChecklistMeta({ checklist: "nope" })).toEqual(empty);
    expect(readChecklistMeta({ checklist: { linkSharedAt: "not-a-date" } })).toEqual(empty);
  });

  it("merges without clobbering other onboardingProfile keys or earlier flags", () => {
    const first = mergeChecklistMeta({ subcategory: "Bridal" }, { linkSharedAt: "2026-10-26T10:00:00.000Z" });
    expect(first.subcategory).toBe("Bridal");
    const second = mergeChecklistMeta(first, { dismissedAt: "2026-10-27T10:00:00.000Z" });
    expect(second.subcategory).toBe("Bridal");
    expect(readChecklistMeta(second)).toEqual({ linkSharedAt: "2026-10-26T10:00:00.000Z", dismissedAt: "2026-10-27T10:00:00.000Z" });
    expect(mergeChecklistMeta(null, { dismissedAt: "2026-10-27T10:00:00.000Z" })).toHaveProperty("checklist");
  });
});

describe("getStarterIdeas", () => {
  it("returns niche-specific ideas that satisfy the product/service validation rules", () => {
    const caps = { sellsProducts: true, offersServices: true };
    for (const type of ["Restaurant", "Fashion", "Beauty", "Salon", "Electronics", "Photography", "Cleaning", "Automotive"] as const) {
      const ideas = getStarterIdeas(type, caps);
      expect(ideas.length).toBeGreaterThan(0);
      for (const i of ideas) {
        expect(i.name.length).toBeGreaterThanOrEqual(2);
        expect(i.description.length).toBeGreaterThanOrEqual(10);
        expect(i.description.length).toBeLessThanOrEqual(255);
        expect(i.price).toBeGreaterThan(0);
        if (i.bookingMode === "appointment") expect(i.durationMins).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("has unique ids and skips ideas the store already has", () => {
    const caps = { sellsProducts: true, offersServices: false };
    const all = getStarterIdeas("Restaurant", caps, [], 10);
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    const filtered = getStarterIdeas("Restaurant", caps, [all[0].name.toUpperCase()], 10);
    expect(filtered.find((i) => i.id === all[0].id)).toBeUndefined();
  });

  it("falls back to generic ideas by capability and offers none for hotels / real estate", () => {
    expect(getStarterIdeas("Other", { sellsProducts: true, offersServices: false })[0].kind).toBe("product");
    expect(getStarterIdeas("Other", { sellsProducts: false, offersServices: true })[0].kind).toBe("service");
    expect(getStarterIdeas("Hotel & Lodging", { sellsProducts: true, offersServices: true })).toEqual([]);
    expect(getStarterIdeas("Real Estate", { sellsProducts: true, offersServices: true })).toEqual([]);
  });
});
