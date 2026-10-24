/** Client-safe palette type + defaults (no theme imports, so client bundles stay small). */
export type StorePalette = {
  accent: string;
  onAccent: string;
  ink: string;
  surface: string;
  card: string;
  cardAlt: string;
  inverse: string;
  inverseInk: string;
  font: string;
  headlineFont: string;
};

/** The original Lumina palette, used when no store theme is available. */
export const DEFAULT_STORE_PALETTE: StorePalette = {
  accent: "#0041C8",
  onAccent: "#FFFFFF",
  ink: "#141D23",
  surface: "#F6FAFF",
  card: "#FFFFFF",
  cardAlt: "#E6EFF8",
  inverse: "#293138",
  inverseInk: "#E9F2FB",
  font: "'Inter', sans-serif",
  headlineFont: "'Plus Jakarta Sans', sans-serif",
};
