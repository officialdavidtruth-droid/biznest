export function extractFnbRecipe(attributes: unknown) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return null;
  const recipe = (attributes as Record<string, unknown>).fnbRecipe;
  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) return null;
  const r = recipe as Record<string, unknown>;
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  return {
    yieldQty: Number(r.yieldQty || 1),
    ingredients: ingredients.map((i: any) => ({
      inventoryItemId: String(i.inventoryItemId || ""),
      quantity: Number(i.quantity || 0),
      unit: String(i.unit || "unit"),
      name: String(i.name || "Ingredient"),
    })).filter((i) => i.inventoryItemId && i.quantity > 0),
  };
}
