"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";
import { RichText } from "@/components/storefront/rich-text";
import { submitContactEnquiry } from "@/lib/actions/contact";
import type { ServiceContent } from "@/lib/service-content";

/** Itinerary, included / not included, FAQs and the related-article link. Renders nothing for empty blocks. */
export function ServiceContentSections({ content, slug, accent, itineraryTitle }: { content: ServiceContent; slug: string; accent: string; itineraryTitle: string }) {
  const { itinerary, included, excluded, faqs, article } = content;
  return (
    <>
      {itinerary.length > 0 && (
        <>
          <h2>{itineraryTitle}</h2>
          <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 12 }}>
            {itinerary.map((d, i) => (
              <li key={i} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 12, alignItems: "start" }}>
                <span style={{ width: 34, height: 34, borderRadius: 999, background: accent, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                <div>
                  {d.title && <b style={{ display: "block", marginBottom: 2 }}>{d.title}</b>}
                  {d.text && <span style={{ color: "var(--hr-muted)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{d.text}</span>}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {(included.length > 0 || excluded.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 24, marginTop: 8 }}>
          {included.length > 0 && (
            <div>
              <h2>What&apos;s included</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8 }}>
                {included.map((t, i) => <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><Check size={16} style={{ color: accent, flex: "none", marginTop: 3 }} />{t}</li>)}
              </ul>
            </div>
          )}
          {excluded.length > 0 && (
            <div>
              <h2>Not included</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8 }}>
                {excluded.map((t, i) => <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--hr-muted)" }}><X size={16} style={{ flex: "none", marginTop: 3 }} />{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {faqs.length > 0 && (
        <>
          <h2>Questions &amp; answers</h2>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {faqs.map((f, i) => (
              <details key={i} style={{ border: "1px solid var(--hr-border)", borderRadius: 12, padding: "12px 14px", background: "var(--hr-card)" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>{f.q}</summary>
                <p style={{ margin: "8px 0 0", color: "var(--hr-muted)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </>
      )}

      {article && (
        <p style={{ marginTop: 24 }}>
          <Link href={`/store/${slug}/blogs/${article}`} style={{ color: accent, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
            Read the full guide <ArrowRight size={15} />
          </Link>
        </p>
      )}
    </>
  );
}

export function StoryText({ text }: { text: string }) {
  return text ? <RichText text={text} className="hr-story" /> : null;
}

/** Short enquiry form for a single service/package. Lands in the merchant's enquiries/leads like the Contact page. */
export function ServiceEnquiryForm({ slug, serviceName, accent }: { slug: string; serviceName: string; accent: string }) {
  const [v, setV] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const box = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hr-border)", background: "transparent", color: "inherit", font: "inherit", fontSize: 14 } as const;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const r = await submitContactEnquiry(slug, { ...v, subject: `Enquiry: ${serviceName}`.slice(0, 120), message: v.message });
      if (r.success) { setSent(true); setV({ name: "", email: "", phone: "", message: "", website: "" }); }
      else setError(r.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div style={{ marginTop: 12, padding: 16, borderRadius: 14, border: "1px solid var(--hr-border)", background: "var(--hr-card)" }}>
        <b>Enquiry sent ✓</b>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--hr-muted)" }}>Thanks — we&apos;ll get back to you shortly.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} style={{ marginTop: 12, padding: 16, borderRadius: 14, border: "1px solid var(--hr-border)", background: "var(--hr-card)", display: "grid", gap: 8 }}>
      <b>Send an enquiry</b>
      <input style={box} placeholder="Your name" value={v.name} onChange={set("name")} required maxLength={120} />
      <input style={box} type="email" placeholder="Email" value={v.email} onChange={set("email")} required />
      <input style={box} inputMode="tel" placeholder="Phone (optional)" value={v.phone} onChange={set("phone")} />
      <textarea style={{ ...box, minHeight: 90, resize: "vertical" }} placeholder={`Tell us what you'd like to know about ${serviceName}`} value={v.message} onChange={set("message")} required maxLength={4000} />
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.website} onChange={set("website")} style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
      {error && <p style={{ margin: 0, fontSize: 12.5, color: "#b42318" }}>{error}</p>}
      <button type="submit" disabled={pending} style={{ border: 0, borderRadius: 10, padding: "12px", background: accent, color: "#fff", fontWeight: 800, cursor: "pointer", opacity: pending ? 0.7 : 1 }}>
        {pending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
