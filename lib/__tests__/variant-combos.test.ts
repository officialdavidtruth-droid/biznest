import { describe, expect, it } from "vitest";
import { cartesian, comboKey, planVariantSync, type ExistingVariant } from "@/lib/variant-combos";

const sizeColor = [
  { name: "Size", values: ["S", "M"] },
  { name: "Color", values: ["Red", "Blue"] },
];

function rowsFor(options: typeof sizeColor, overrides: Partial<Record<string, Partial<ExistingVariant>>> = {}): ExistingVariant[] {
  return cartesian(options).map((c, i) => ({
    id: `v${i}`,
    label: Object.values(c).join(" / "),
    optionValues: c,
    isActive: true,
    ...(overrides[comboKey(c)] ?? {}),
  }));
}

describe("planVariantSync", () => {
  it("creates every combo for a brand new schema", () => {
    const plan = planVariantSync([], null, sizeColor);
    expect(plan.toCreate).toHaveLength(4);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDeactivate).toHaveLength(0);
  });

  it("keeps existing rows (and their stock) when the axes are reordered", () => {
    const existing = rowsFor(sizeColor);
    const reordered = [sizeColor[1], sizeColor[0]];
    const plan = planVariantSync(existing, sizeColor, reordered);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toDeactivate).toHaveLength(0);
    // Only the display labels are refreshed to the new axis order.
    expect(plan.toUpdate).toHaveLength(4);
    expect(plan.toUpdate.every((u) => !u.reactivate)).toBe(true);
    expect(plan.toUpdate.find((u) => u.id === "v0")?.label).toBe("Red / S");
  });

  it("deactivates, never deletes, combos whose value was removed", () => {
    const existing = rowsFor(sizeColor);
    const plan = planVariantSync(existing, sizeColor, [sizeColor[0], { name: "Color", values: ["Red"] }]);
    expect(plan.toDeactivate).toHaveLength(2);
    expect(plan.toCreate).toHaveLength(0);
  });

  it("reactivates a variant when its removed value is added back", () => {
    const afterRemoval = [sizeColor[0], { name: "Color", values: ["Red"] }];
    const existing = rowsFor(sizeColor, {
      [comboKey({ Size: "S", Color: "Blue" })]: { isActive: false },
      [comboKey({ Size: "M", Color: "Blue" })]: { isActive: false },
    });
    const plan = planVariantSync(existing, afterRemoval, sizeColor);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate.filter((u) => u.reactivate)).toHaveLength(2);
  });

  it("leaves a merchant-deactivated variant switched off", () => {
    const existing = rowsFor(sizeColor, { [comboKey({ Size: "S", Color: "Red" })]: { isActive: false } });
    const plan = planVariantSync(existing, sizeColor, sizeColor);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDeactivate).toHaveLength(0);
  });
});
