import { describe, expect, it } from "vitest";
import { careersPath, jobAcceptsApplications, parsePublicApplication } from "@/lib/recruitment-public";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { firstName: " Ada ", lastName: "Obi", email: "ADA@Example.com" };

describe("public application parsing", () => {
  it("normalises a valid application", () => {
    const r = parsePublicApplication(fd({ ...base, cvLink: "https://x.com/cv.pdf" }), false);
    expect(r.ok && r.data.email).toBe("ada@example.com");
    expect(r.ok && r.data.firstName).toBe("Ada");
    expect(r.ok && r.data.phone).toBeNull();
  });
  it("needs a name, a valid email and a CV (file or link)", () => {
    expect(parsePublicApplication(fd({ firstName: "A", email: "a@b.co" }), true).ok).toBe(false);
    expect(parsePublicApplication(fd({ ...base, email: "nope" }), true).ok).toBe(false);
    expect(parsePublicApplication(fd(base), false).ok).toBe(false);
    expect(parsePublicApplication(fd(base), true).ok).toBe(true);
  });
  it("rejects non-http CV links and caps long text", () => {
    expect(parsePublicApplication(fd({ ...base, cvLink: "javascript:alert(1)" }), true).ok).toBe(false);
    const r = parsePublicApplication(fd({ ...base, coverNote: "x".repeat(5000) }), true);
    expect(r.ok && r.data.coverNote?.length).toBe(2000);
  });
});

describe("job acceptance", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  it("only OPEN jobs, until the end of the closing date", () => {
    expect(jobAcceptsApplications({ status: "OPEN", closesAt: null }, now)).toBe(true);
    expect(jobAcceptsApplications({ status: "OPEN", closesAt: new Date("2026-11-10") }, now)).toBe(true);
    expect(jobAcceptsApplications({ status: "OPEN", closesAt: new Date("2026-11-09") }, now)).toBe(false);
    for (const status of ["DRAFT", "ON_HOLD", "FILLED", "CLOSED"]) expect(jobAcceptsApplications({ status, closesAt: null }, now)).toBe(false);
  });
  it("builds the careers path", () => expect(careersPath("acme")).toBe("/store/acme/careers"));
});

import { formatPublicSalary } from "@/lib/recruitment-public";
describe("public salary display", () => {
  const n = (s: string | null) => s?.replace(/ /g, " ");
  it("formats ranges, one-sided ranges and nothing", () => {
    expect(formatPublicSalary(null, null)).toBeNull();
    expect(n(formatPublicSalary(300000, 450000))).toBe("₦300,000 – ₦450,000");
    expect(n(formatPublicSalary(300000, null))).toBe("From ₦300,000");
    expect(n(formatPublicSalary(null, 450000))).toBe("Up to ₦450,000");
    expect(n(formatPublicSalary(300000, 300000))).toBe("₦300,000");
  });
  it("survives an unknown currency code", () => expect(formatPublicSalary(1000, null, "??")).toContain("1,000"));
});
