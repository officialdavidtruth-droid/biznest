import { describe, expect, it } from "vitest";
import { lineVariance, summariseCount } from "../audit-math";

describe("audit count maths", () => {
  it("treats an uncounted line as no variance", () => {
    expect(lineVariance({ expectedQty: 10, countedQty: null, unitCost: 5 })).toEqual({ qty: 0, value: 0, counted: false });
  });
  it("shortage is positive, surplus negative", () => {
    expect(lineVariance({ expectedQty: 10, countedQty: 8, unitCost: 5 })).toEqual({ qty: 2, value: 10, counted: true });
    expect(lineVariance({ expectedQty: 10, countedQty: 12, unitCost: 5 }).value).toBe(-10);
  });
  it("summarises a count", () => {
    const s = summariseCount([
      { expectedQty: 10, countedQty: 10, unitCost: 5 },
      { expectedQty: 10, countedQty: 8, unitCost: 5 },
      { expectedQty: 4, countedQty: 5, unitCost: 10 },
      { expectedQty: 3, countedQty: null, unitCost: 100 },
    ]);
    expect(s).toMatchObject({ total: 4, counted: 3, remaining: 1, matched: 1, shortages: 1, surpluses: 1, shortageValue: 10, surplusValue: 10, netVariance: 0, accuracyPct: 33.33, progressPct: 75 });
    expect(s.expectedValue).toBe(440);
  });
  it("an empty audit is 0% not NaN", () => {
    expect(summariseCount([])).toMatchObject({ total: 0, progressPct: 0, accuracyPct: 0 });
  });
});
