import { describe, expect, it } from "vitest";
import { summariseCount } from "../audit-math";

describe("blind count progress", () => {
  it("progress needs no system quantities", () => {
    const s = summariseCount([{ expectedQty: 0, countedQty: 5, unitCost: 0 }, { expectedQty: 0, countedQty: null, unitCost: 0 }]);
    expect(s).toMatchObject({ total: 2, counted: 1, remaining: 1, progressPct: 50 });
  });
});
