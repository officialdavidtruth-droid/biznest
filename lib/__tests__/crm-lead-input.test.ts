import { describe, expect, it } from "vitest";
import { MAX_LEAD_VALUE, normalizeEmail, parseFollowUp, parseLeadValue, validateLeadContact, validateNewLead } from "@/lib/crm-lead-input";

describe("crm lead input", () => {
  it("normalises email case and blanks", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("accepts a minimal lead and defaults the source to MANUAL", () => {
    const r = validateNewLead({ name: "  Ada   Obi " });
    expect(r.ok && r.data).toMatchObject({ name: "Ada Obi", email: null, phone: null, source: "MANUAL", value: null, nextFollowUpAt: null });
  });

  it("lowercases email and rejects bad email/phone/name", () => {
    const ok = validateLeadContact({ name: "A", email: "A@B.co", phone: "+234 801 234 5678" });
    expect(ok.ok && ok.data.email).toBe("a@b.co");
    expect(validateLeadContact({ name: "A", email: "nope" }).ok).toBe(false);
    expect(validateLeadContact({ name: "A", phone: "abc" }).ok).toBe(false);
    expect(validateLeadContact({ name: "  " }).ok).toBe(false);
    expect(validateLeadContact({ name: "x".repeat(121) }).ok).toBe(false);
  });

  it("falls back to MANUAL for an unknown source", () => {
    const r = validateLeadContact({ name: "A", source: "HACK" });
    expect(r.ok && r.data.source).toBe("MANUAL");
  });

  it("keeps value inside Decimal(12,2)", () => {
    expect(parseLeadValue(MAX_LEAD_VALUE)).toEqual({ ok: true, value: MAX_LEAD_VALUE });
    expect(parseLeadValue(1e10).ok).toBe(false);
    expect(parseLeadValue(-1).ok).toBe(false);
    expect(parseLeadValue(NaN).ok).toBe(false);
    expect(parseLeadValue(null)).toEqual({ ok: true, value: null });
    expect(parseLeadValue(12.345)).toEqual({ ok: true, value: 12.35 });
  });

  it("rejects an invalid follow-up date instead of storing Invalid Date", () => {
    expect(parseFollowUp("not-a-date").ok).toBe(false);
    expect(parseFollowUp("")).toEqual({ ok: true, date: null });
    const d = parseFollowUp("2026-11-05T09:00:00.000Z");
    expect(d.ok && d.date?.toISOString()).toBe("2026-11-05T09:00:00.000Z");
  });

  it("treats a zero estimate as no value", () => {
    const r = validateNewLead({ name: "A", value: 0 });
    expect(r.ok && r.data.value).toBeNull();
  });
});
