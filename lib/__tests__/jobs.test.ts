import { describe, expect, it } from "vitest";
import { PROFILES, defaultNiche, deliverableVisible, firstStage, isStage, itemsTotal, jobNumber, lastJobSeq, lastStage, outstanding, progressPct, safeHttpsUrl, sanitizeItem, sanitizeJobCard, splitCharges, stageLabel } from "@/lib/jobs";

describe("niches and stages", () => {
  it("has a first and last stage for every niche", () => {
    for (const n of ["AUTO", "CLEANING", "CONSTRUCTION", "PHOTOGRAPHY"] as const) {
      expect(isStage(n, firstStage(n))).toBe(true);
      expect(isStage(n, lastStage(n))).toBe(true);
      expect(progressPct(n, firstStage(n))).toBe(0);
      expect(progressPct(n, lastStage(n))).toBe(100);
    }
    expect(isStage("AUTO", "SHOT")).toBe(false);
    expect(stageLabel("PHOTOGRAPHY", "PROOFS")).toBe("Proofs ready");
    expect(progressPct("AUTO", "READY")).toBe(80);
    expect(PROFILES.PHOTOGRAPHY.deliverableLabel).toBe("Final gallery");
  });
  it("guesses a niche from the business type", () => {
    expect(defaultNiche("Photography")).toBe("PHOTOGRAPHY");
    expect(defaultNiche("Professional Services", "Cleaning")).toBe("CLEANING");
    expect(defaultNiche("Professional Services", "Construction")).toBe("CONSTRUCTION");
    expect(defaultNiche("Automotive")).toBe("AUTO");
  });
});

describe("numbers and money", () => {
  it("formats job numbers", () => {
    expect(jobNumber(7)).toBe("JOB-00007");
    expect(lastJobSeq(["JOB-00002", "JOB-00011", "x"])).toBe(11);
  });
  it("totals items and ignores junk quantities", () => {
    expect(itemsTotal([{ qty: 2, unitPrice: 1500.5 }, { qty: 1, unitPrice: "200" }, { qty: -3, unitPrice: 100 }])).toBe(3201);
  });
  it("splits deposit and balance exactly", () => {
    const s = splitCharges(100001, 50);
    expect(s).toHaveLength(2);
    expect(s[0].amount + s[1].amount).toBeCloseTo(100001, 2);
    expect(splitCharges(5000, 0)).toEqual([{ label: "Payment", amount: 5000 }]);
    expect(splitCharges(5000, 100)).toEqual([{ label: "Full payment", amount: 5000 }]);
    expect(splitCharges(0, 50)).toEqual([]);
  });
  it("sums only due charges and gates the deliverable", () => {
    expect(outstanding([{ status: "DUE", amount: 100 }, { status: "PAID", amount: 900 }, { status: "VOID", amount: 5 }])).toBe(100);
    expect(deliverableVisible([{ status: "PAID", amount: 1 }, { status: "VOID", amount: 1 }])).toBe(true);
    expect(deliverableVisible([{ status: "PAID", amount: 1 }, { status: "DUE", amount: 1 }])).toBe(false);
    expect(deliverableVisible([])).toBe(true);
  });
});

describe("sanitizers", () => {
  it("validates a job", () => {
    expect(sanitizeJobCard({ niche: "NOPE", customerName: "A" })).toMatchObject({ ok: false });
    expect(sanitizeJobCard({ niche: "AUTO", customerName: " " })).toMatchObject({ ok: false });
    expect(sanitizeJobCard({ niche: "AUTO", customerName: "Ada", customerEmail: "bad" })).toMatchObject({ ok: false });
    expect(sanitizeJobCard({ niche: "AUTO", customerName: "Ada", scheduledFor: "x" })).toMatchObject({ ok: false });
    const r = sanitizeJobCard({ niche: "CLEANING", customerName: "Ada", customerPhone: "0801 000 0000" });
    expect(r).toMatchObject({ ok: true, job: { title: "Cleaning", customerPhone: "08010000000" } });
  });
  it("validates items", () => {
    expect(sanitizeItem({ label: "", unitPrice: 5 })).toMatchObject({ ok: false });
    expect(sanitizeItem({ label: "Pads", qty: 0, unitPrice: 5 })).toMatchObject({ ok: false });
    expect(sanitizeItem({ label: "Pads", qty: 1, unitPrice: -1 })).toMatchObject({ ok: false });
    expect(sanitizeItem({ label: "Pads", qty: "2", unitPrice: "1,000", kind: "WEIRD" })).toEqual({ ok: true, item: { kind: "OTHER", label: "Pads", qty: 2, unitPrice: 1000 } });
  });
  it("accepts only https links", () => {
    expect(safeHttpsUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpsUrl("http://example.com")).toBeNull();
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("")).toBeNull();
  });
});
