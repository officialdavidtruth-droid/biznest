import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { computeRecipeRequirements } from "@/lib/fnb-recipe-stock";

const recipe = (yieldQty: number, ingredients: Array<{ id: string; qty: number }>) => ({
  fnbRecipe: { yieldQty, ingredients: ingredients.map((i) => ({ inventoryItemId: i.id, quantity: i.qty, unit: "g", name: i.id })) },
});

describe("computeRecipeRequirements", () => {
  it("returns null when the dish has no recipe", () => {
    expect(computeRecipeRequirements(null, 2)).toBeNull();
    expect(computeRecipeRequirements({}, 2)).toBeNull();
    expect(computeRecipeRequirements(recipe(4, []), 2)).toBeNull();
  });

  it("scales per portion by the recipe yield", () => {
    expect(computeRecipeRequirements(recipe(4, [{ id: "rice", qty: 800 }]), 1)).toEqual([{ inventoryItemId: "rice", quantity: 200 }]);
    expect(computeRecipeRequirements(recipe(4, [{ id: "rice", qty: 800 }]), 3)).toEqual([{ inventoryItemId: "rice", quantity: 600 }]);
  });

  it("rounds the whole sale up once, not per portion", () => {
    // 10 g per 3 portions: 5 portions need 16.67 g -> 17, not 5 * ceil(3.33) = 20.
    expect(computeRecipeRequirements(recipe(3, [{ id: "salt", qty: 10 }]), 5)).toEqual([{ inventoryItemId: "salt", quantity: 17 }]);
  });

  it("does not round up on floating point noise", () => {
    expect(computeRecipeRequirements(recipe(10, [{ id: "oil", qty: 1 }]), 3)).toEqual([{ inventoryItemId: "oil", quantity: 1 }]);
  });

  it("merges repeated ingredients", () => {
    const attrs = recipe(1, [{ id: "egg", qty: 2 }, { id: "egg", qty: 1 }]);
    expect(computeRecipeRequirements(attrs, 2)).toEqual([{ inventoryItemId: "egg", quantity: 6 }]);
  });

  it("returns no requirements for a non-positive portion count", () => {
    expect(computeRecipeRequirements(recipe(1, [{ id: "egg", qty: 2 }]), 0)).toEqual([]);
  });
});
