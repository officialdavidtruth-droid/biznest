/** Pure validation/normalisation for CRM leads. No I/O so it is unit-testable and shared by every lead entry point. */

export const LEAD_SOURCES = ["WEBSITE", "FORM", "WHATSAPP", "EMAIL", "PHONE", "BOOKING", "ORDER", "REFERRAL", "SOCIAL", "MANUAL", "OTHER"] as const;
export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
export const ACTIVITY_TYPES = ["NOTE", "CALL", "EMAIL", "MEETING"] as const;
/** Activity types that mean "we actually spoke to them" (a plain note does not). */
export const CONTACT_ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING"] as const;

/** CrmLead.value is Decimal(12,2): the largest storable amount is 9,999,999,999.99. */
export const MAX_LEAD_VALUE = 9_999_999_999.99;

export const LEAD_LIMITS = { name: 120, email: 254, phone: 30, company: 120, notes: 2000, activityTitle: 180, activityBody: 2000 } as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d][\d\s().+-]{5,24}$/;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const isLeadSource = (v: unknown): v is LeadSource => typeof v === "string" && (LEAD_SOURCES as readonly string[]).includes(v);
export const isLeadStatus = (v: unknown): v is LeadStatus => typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Lower-cased, trimmed email, or null when blank. Does not validate the format. */
export function normalizeEmail(v: string | null | undefined): string | null {
  const e = text(v).toLowerCase();
  return e || null;
}

export type LeadContactFields = { name: string; email: string | null; phone: string | null; company: string | null; source: LeadSource };
type Fail = { ok: false; error: string };

export function validateLeadContact(input: { name?: unknown; email?: unknown; phone?: unknown; company?: unknown; source?: unknown }): { ok: true; data: LeadContactFields } | Fail {
  const name = text(input.name).replace(/\s+/g, " ");
  if (name.length < 1) return { ok: false, error: "Lead name is required." };
  if (name.length > LEAD_LIMITS.name) return { ok: false, error: "That name is too long." };

  const email = normalizeEmail(typeof input.email === "string" ? input.email : null);
  if (email && (email.length > LEAD_LIMITS.email || !EMAIL_RE.test(email))) return { ok: false, error: "That email address doesn't look right." };

  const phone = text(input.phone) || null;
  if (phone && (phone.length > LEAD_LIMITS.phone || !PHONE_RE.test(phone))) return { ok: false, error: "That phone number doesn't look right." };

  const company = text(input.company) || null;
  if (company && company.length > LEAD_LIMITS.company) return { ok: false, error: "That company name is too long." };

  const source: LeadSource = isLeadSource(input.source) ? input.source : "MANUAL";
  return { ok: true, data: { name, email, phone, company, source } };
}

export function parseLeadValue(v: unknown): { ok: true; value: number | null } | Fail {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > MAX_LEAD_VALUE) return { ok: false, error: "Enter a valid value." };
  return { ok: true, value: Math.round(v * 100) / 100 };
}

export function parseFollowUp(v: unknown): { ok: true; date: Date | null } | Fail {
  if (v === null || v === undefined || v === "") return { ok: true, date: null };
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Enter a valid follow-up date." };
  return { ok: true, date: d };
}

export function cleanNotes(v: unknown, max: number = LEAD_LIMITS.notes): string | null {
  return text(v).slice(0, max) || null;
}

export type NewLeadInput = LeadContactFields & { value: number | null; notes: string | null; nextFollowUpAt: Date | null };

export function validateNewLead(input: { name?: unknown; email?: unknown; phone?: unknown; company?: unknown; source?: unknown; value?: unknown; notes?: unknown; nextFollowUpAt?: unknown }): { ok: true; data: NewLeadInput } | Fail {
  const contact = validateLeadContact(input);
  if (!contact.ok) return contact;
  // A blank or zero estimate means "no value yet".
  const value = parseLeadValue(input.value === 0 ? null : input.value);
  if (!value.ok) return value;
  const follow = parseFollowUp(input.nextFollowUpAt);
  if (!follow.ok) return follow;
  return { ok: true, data: { ...contact.data, value: value.value, notes: cleanNotes(input.notes), nextFollowUpAt: follow.date } };
}
