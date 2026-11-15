import { describe, expect, it } from "vitest";
import { cellId, colName, displayValue, evaluateSheet, parseCellId } from "../sheet-engine";

const v = (cells: Record<string, string>, id: string) => evaluateSheet(cells)[id];

describe("cell addressing", () => {
  it("converts between letters and indexes", () => {
    expect(colName(0)).toBe("A"); expect(colName(25)).toBe("Z"); expect(colName(26)).toBe("AA");
    expect(parseCellId("B12")).toEqual({ col: 1, row: 11 });
    expect(cellId(2, 4)).toBe("C5");
    expect(parseCellId("12B")).toBeNull();
  });
});

describe("arithmetic", () => {
  it("respects precedence and parentheses", () => {
    expect(v({ A1: "=2+3*4" }, "A1")).toBe(14);
    expect(v({ A1: "=(2+3)*4" }, "A1")).toBe(20);
    expect(v({ A1: "=2^3^2" }, "A1")).toBe(64);
    expect(v({ A1: "=-2^2" }, "A1")).toBe(4);
  });
  it("handles percent, text joins and typed numbers", () => {
    expect(v({ A1: "=50%*200" }, "A1")).toBe(100);
    expect(v({ A1: "1,250.50", B1: "=A1*2" }, "B1")).toBe(2501);
    expect(v({ A1: "=\"Net: \"&10" }, "A1")).toBe("Net: 10");
  });
  it("reports divide by zero and bad names", () => {
    expect(v({ A1: "=1/0" }, "A1")).toEqual({ error: "#DIV/0!" });
    expect(v({ A1: "=FOO(1)" }, "A1")).toEqual({ error: "#NAME?" });
    expect(v({ A1: "=1+" }, "A1")).toEqual({ error: "#ERR!" });
    expect(v({ A1: "text", B1: "=A1+1" }, "B1")).toEqual({ error: "#VALUE!" });
  });
});

describe("references and ranges", () => {
  const cells = { A1: "10", A2: "20", A3: "30", B1: "=SUM(A1:A3)", B2: "=AVERAGE(A1:A3)", B3: "=MAX(A1:A3)-MIN(A1:A3)", B4: "=COUNT(A1:A3,5)" };
  it("aggregates a range", () => {
    const r = evaluateSheet(cells);
    expect(r.B1).toBe(60); expect(r.B2).toBe(20); expect(r.B3).toBe(20); expect(r.B4).toBe(4);
  });
  it("follows chains of formulas", () => {
    expect(v({ A1: "5", A2: "=A1*2", A3: "=A2+A1" }, "A3")).toBe(15);
  });
  it("detects circular references", () => {
    const r = evaluateSheet({ A1: "=B1", B1: "=A1" });
    expect(r.A1).toEqual({ error: "#CIRC!" });
  });
  it("skips text and blanks inside ranges", () => {
    expect(v({ A1: "1", A2: "note", A4: "3", B1: "=SUM(A1:A4)" }, "B1")).toBe(4);
  });
});

describe("functions", () => {
  it("IF, AND, OR, IFERROR", () => {
    expect(v({ A1: "=IF(5>3,\"yes\",\"no\")" }, "A1")).toBe("yes");
    expect(v({ A1: "=AND(1<2,2<3)" }, "A1")).toBe(true);
    expect(v({ A1: "=OR(1>2,2>3)" }, "A1")).toBe(false);
    expect(v({ A1: "=IFERROR(1/0,0)" }, "A1")).toBe(0);
  });
  it("rounds half away from zero", () => {
    expect(v({ A1: "=ROUND(2.5,0)" }, "A1")).toBe(3);
    expect(v({ A1: "=ROUND(-2.675,2)" }, "A1")).toBe(-2.68);
    expect(v({ A1: "=ROUNDDOWN(9.99,1)" }, "A1")).toBe(9.9);
  });
  it("SUMIF and COUNTIF with criteria", () => {
    const c = { A1: "food", A2: "fuel", A3: "food", B1: "100", B2: "50", B3: "25", C1: "=SUMIF(A1:A3,\"food\",B1:B3)", C2: "=COUNTIF(B1:B3,\">=50\")" };
    const r = evaluateSheet(c);
    expect(r.C1).toBe(125); expect(r.C2).toBe(2);
  });
  it("PMT and NPV", () => {
    expect(Math.round(v({ A1: "=PMT(0.01,12,1000)" }, "A1") as number)).toBe(-89);
    expect(Math.round(v({ A1: "=NPV(0.1,100,100)" }, "A1") as number)).toBe(174);
  });
});

describe("display", () => {
  it("formats numbers, booleans and errors", () => {
    expect(displayValue(1234567)).toBe("1,234,567");
    expect(displayValue(0.5)).toBe("0.5");
    expect(displayValue(true)).toBe("TRUE");
    expect(displayValue({ error: "#DIV/0!" })).toBe("#DIV/0!");
  });
});
