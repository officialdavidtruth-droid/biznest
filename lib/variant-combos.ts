import type { VariantOption } from "@/lib/validations/variant";

export type ComboValues = Record<string, string>;

export type ExistingVariant = {
  id: string;
  label: string;
  optionValues: ComboValues;
  isActive: boolean;
};

export function comboLabel(combo: ComboValues): string {
  return Object.values(combo).join(" / ");
}

/**
 * Order-independent identity of a variant: sorted "axis=value" pairs. Using
 * this instead of the display label means reordering the option axes keeps
 * matching the existing rows (and their stock).
 */
export function comboKey(combo: ComboValues): string {
  return Object.entries(combo)
    .map(([k, v]) => `${k.trim().toLowerCase()}=${String(v).trim().toLowerCase()}`)
    .sort()
    .join("|");
}

/** Cartesian product of each option's values, e.g. Size x Color -> every combo. */
export function cartesian(options: VariantOption[]): ComboValues[] {
  return options.reduce<ComboValues[]>(
    (combos, opt) => combos.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v }))),
    [{}]
  );
}

/**
 * Works out what saving a new option schema should do to a product's variant
 * rows, without touching the database:
 *  - combos with no existing row are created;
 *  - combos matching an existing row (in any axis order) keep that row and its
 *    stock, with its label refreshed;
 *  - an inactive row comes back only if it was switched off by the old schema
 *    (its value had been removed), never if the merchant deactivated it;
 *  - rows no longer in the schema are deactivated, never deleted.
 */
export function planVariantSync(existing: ExistingVariant[], previousOptions: VariantOption[] | null, options: VariantOption[]) {
  const combos = cartesian(options);
  const existingByKey = new Map(existing.map((v) => [comboKey(v.optionValues), v]));
  const validKeys = new Set(combos.map(comboKey));
  const previousKeys = new Set(previousOptions ? cartesian(previousOptions).map(comboKey) : []);

  const toCreate: { optionValues: ComboValues; label: string }[] = [];
  const toUpdate: { id: string; label: string; optionValues: ComboValues; reactivate: boolean }[] = [];

  for (const combo of combos) {
    const key = comboKey(combo);
    const label = comboLabel(combo);
    const match = existingByKey.get(key);
    if (!match) {
      toCreate.push({ optionValues: combo, label });
      continue;
    }
    const reactivate = !match.isActive && !previousKeys.has(key);
    if (reactivate || match.label !== label) toUpdate.push({ id: match.id, label, optionValues: combo, reactivate });
  }

  const toDeactivate = existing.filter((v) => v.isActive && !validKeys.has(comboKey(v.optionValues))).map((v) => v.id);
  return { combos, toCreate, toUpdate, toDeactivate };
}
