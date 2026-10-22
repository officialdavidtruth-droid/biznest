/** Pure validation for the public storefront Contact form. No I/O so it is unit-testable. */

export type ContactEnquiryInput = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  /** Honeypot: a real visitor never sees or fills this field. */
  website?: string;
};

export type CleanContactEnquiry = { name: string; email: string; phone: string | null; subject: string; message: string };

export type ContactValidation =
  | { ok: true; data: CleanContactEnquiry }
  | { ok: false; error: string; spam?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d][\d\s().+-]{5,24}$/;

export const CONTACT_LIMITS = { name: 120, email: 254, subject: 120, message: 4000, minMessage: 10 } as const;

export function validateContactEnquiry(input: ContactEnquiryInput): ContactValidation {
  // Bots fill every field. Pretend success upstream, store nothing.
  if ((input.website ?? "").trim()) return { ok: false, error: "", spam: true };

  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim();
  const subject = (input.subject ?? "").trim() || "General enquiry";
  const message = (input.message ?? "").trim();

  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (name.length > CONTACT_LIMITS.name) return { ok: false, error: "That name is too long." };
  if (!email || !EMAIL_RE.test(email) || email.length > CONTACT_LIMITS.email) return { ok: false, error: "Please enter a valid email address so we can reply." };
  if (phone && !PHONE_RE.test(phone)) return { ok: false, error: "That phone number doesn't look right." };
  if (subject.length > CONTACT_LIMITS.subject) return { ok: false, error: "That subject is too long." };
  if (message.length < CONTACT_LIMITS.minMessage) return { ok: false, error: "Please tell us a little more in your message." };
  if (message.length > CONTACT_LIMITS.message) return { ok: false, error: `Please keep your message under ${CONTACT_LIMITS.message} characters.` };

  return { ok: true, data: { name, email, phone: phone || null, subject, message } };
}
