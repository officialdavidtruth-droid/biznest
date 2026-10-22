import { describe, expect, it } from "vitest";
import { validateContactEnquiry, CONTACT_LIMITS } from "@/lib/contact-enquiry";

const ok = { name: "Ada Obi", email: "Ada@Example.com", phone: "", subject: "", message: "Do you have rooms free next weekend?" };

describe("contact enquiry validation", () => {
  it("accepts a normal enquiry and normalises it", () => {
    const r = validateContactEnquiry({ ...ok, name: "  Ada   Obi ", phone: " +234 801 234 5678 " });
    expect(r).toEqual({ ok: true, data: { name: "Ada Obi", email: "ada@example.com", phone: "+234 801 234 5678", subject: "General enquiry", message: ok.message } });
  });

  it("treats the phone as optional", () => {
    const r = validateContactEnquiry(ok);
    expect(r.ok && r.data.phone).toBe(null);
  });

  it.each([
    ["short name", { name: "A" }],
    ["missing email", { email: "" }],
    ["invalid email", { email: "not-an-email" }],
    ["bad phone", { phone: "abc" }],
    ["short message", { message: "hi" }],
    ["very long message", { message: "x".repeat(CONTACT_LIMITS.message + 1) }],
    ["very long subject", { subject: "s".repeat(CONTACT_LIMITS.subject + 1) }],
  ])("rejects %s", (_label, patch) => {
    const r = validateContactEnquiry({ ...ok, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toBe("");
  });

  it("flags honeypot submissions as spam without an error message", () => {
    expect(validateContactEnquiry({ ...ok, website: "http://spam.example" })).toEqual({ ok: false, error: "", spam: true });
  });
});
