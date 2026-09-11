export type FnbRotationMode = "FIFO" | "FEFO";

export function getFnbRotationMode(enabledModules: unknown): FnbRotationMode {
  if (enabledModules && typeof enabledModules === "object" && !Array.isArray(enabledModules)) {
    const value = (enabledModules as Record<string, unknown>).fnbRotationMode;
    if (value === "FEFO" || value === "FIFO") return value;
  }
  return "FIFO";
}
