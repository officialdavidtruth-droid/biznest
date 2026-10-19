import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Settlement / award helpers take caller-supplied amounts or transactions and
 * do no auth of their own. Exporting them from a "use server" file would make
 * them callable endpoints, so they must live in server-only modules.
 */
const FORBIDDEN = /export\s+async\s+function\s+(settle[A-Z]\w*|decrementStockForOrder|awardLoyaltyPointsForOrder|awardStoreLoyaltyPointsForOrder|confirmPaidBooking)\b/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === ".next" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe("payment settlement helpers are not server actions", () => {
  it('no "use server" file exports a settle*/stock/loyalty-award helper', () => {
    const offenders = ["lib", "app"].flatMap(walk).filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return /^\s*["']use server["']/.test(src) && FORBIDDEN.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("every lib/payments settlement module imports server-only", () => {
    const files = fs.readdirSync("lib/payments").filter((f) => /^(settle-|stock|loyalty-award|booking-confirmation)/.test(f) && f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(fs.readFileSync(path.join("lib/payments", f), "utf8"), f).toContain('import "server-only";');
    }
  });
});
