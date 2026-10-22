"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { submitContactEnquiry } from "@/lib/actions/contact";

type Props = { slug: string; accent: string; subjects: string[]; phonePlaceholder?: string };

const EMPTY = { name: "", email: "", phone: "", subject: "", message: "", website: "" };

/**
 * The storefront Contact form. It renders the <form className="bn-contact-form">
 * itself (rather than nesting inside a div) because the stylesheet targets its
 * direct children (.bn-contact-form>small, >p, >label).
 */
export function ContactEnquiryForm({ slug, accent, subjects, phonePlaceholder }: Props) {
  const [values, setValues] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (!consent) {
      setError("Please tick the box to let us contact you about your enquiry.");
      return;
    }
    setPending(true);
    try {
      const result = await submitContactEnquiry(slug, values);
      if (result.success) {
        setSent(true);
        setValues(EMPTY);
        setConsent(false);
      } else {
        setError(result.error);
      }
    } catch {
      setError("We couldn’t send your message. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="bn-contact-form" role="status" aria-live="polite">
        <small>MESSAGE SENT</small>
        <h2>Thank you, we’ve got it.</h2>
        <p>Your message has been sent. We’ll reply to the email address you gave us as soon as we can.</p>
        <button type="button" className="bn-primary" style={{ background: accent, border: 0, cursor: "pointer", font: "inherit", fontWeight: 800, fontSize: 12 }} onClick={() => setSent(false)}>
          Send another message <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <form className="bn-contact-form" onSubmit={onSubmit} noValidate>
      <small>SEND US A MESSAGE</small>
      <h2>Let’s Talk About Your Project</h2>
      <p>Fill out the form below and we’ll get back to you as soon as possible.</p>
      <div className="bn-form-grid">
        <label>Full Name<input name="name" autoComplete="name" required maxLength={120} value={values.name} onChange={set("name")} placeholder="e.g. John Doe" /></label>
        <label>Email Address<input name="email" type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={set("email")} placeholder="e.g. john@example.com" /></label>
        <label>Phone Number<input name="phone" type="tel" autoComplete="tel" maxLength={25} value={values.phone} onChange={set("phone")} placeholder={phonePlaceholder || "Your phone number"} /></label>
        <label>Subject
          <select name="subject" value={values.subject} onChange={set("subject")}>
            <option value="">Select a subject</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label>Your Message
        <textarea name="message" required maxLength={4000} value={values.message} onChange={set("message")} placeholder="Tell us about your project, requirements, or any questions..." />
      </label>
      {/* Honeypot: hidden from people and assistive tech, filled in by bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} /></label>
      </div>
      {error && <p role="alert" style={{ color: "#b42318", fontSize: 12, fontWeight: 700, margin: "12px 0 0" }}>{error}</p>}
      <div className="bn-form-bottom">
        <label className="bn-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I agree to be contacted about my enquiry.</label>
        <button type="submit" disabled={pending} className="bn-primary" style={{ background: accent, border: 0, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1, font: "inherit", fontWeight: 800, fontSize: 12 }}>
          {pending ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <>Send Message <ArrowRight size={16} /></>}
        </button>
      </div>
    </form>
  );
}
