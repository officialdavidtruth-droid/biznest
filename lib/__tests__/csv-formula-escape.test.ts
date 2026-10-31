import { describe, expect, it } from "vitest";
import { toCsv, parseCsv, escapeFormulaCell, unescapeFormulaCell } from "@/lib/utils/csv";

describe("CSV formula injection guard", () => {
  it("prefixes formula-like text so spreadsheets show it as text", () => {
    for (const v of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd"]) {
      expect(escapeFormulaCell(v).startsWith("'")).toBe(true);
    }
    expect(escapeFormulaCell("Jollof rice")).toBe("Jollof rice");
  });

  it("keeps negative numbers numeric (only strings are guarded)", () => {
    expect(toCsv(["a"], [[-5]])).toBe("a\n-5");
  });

  it("round-trips through export then import", () => {
    const original = "=1+1, \"quoted\"";
    const csv = toCsv(["name"], [[original]]);
    const parsed = parseCsv(csv);
    expect(unescapeFormulaCell(parsed[1][0])).toBe(original);
  });

  it("does not strip an ordinary leading apostrophe", () => {
    expect(unescapeFormulaCell("'Tis the season")).toBe("'Tis the season");
  });
});
