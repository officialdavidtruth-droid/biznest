"use client";

import { useState, useTransition, type FormEvent } from "react";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

export function StorefrontNewsletter({
  slug,
  storeName,
  accent,
  background,
  color,
  muted,
  border,
}: {
  slug: string;
  storeName: string;
  accent: string;
  background: string;
  color: string;
  muted?: string;
  border?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await subscribeToNewsletter(slug, formData);
      if (result.success) {
        setEmail("");
        setStatus("You're subscribed. We'll keep you posted.");
      } else {
        setStatus(result.error ?? "Could not subscribe. Please try again.");
      }
    });
  }

  return (
    <section aria-labelledby={`newsletter-${slug}`} style={{ padding: "70px 28px", background: background, color }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }} className="bn-2col">
        <div>
          <div style={{ color: accent, fontSize: 10, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase" }}>Stay in the loop</div>
          <h2 id={`newsletter-${slug}`} style={{ margin: "12px 0 10px", fontSize: "clamp(30px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-.03em" }}>
            Get updates from {storeName}
          </h2>
          <p style={{ margin: 0, maxWidth: 520, color: muted ?? `${color}99`, lineHeight: 1.7, fontSize: 14 }}>
            New products, services, announcements and useful updates — sent only when there is something worth sharing.
          </p>
        </div>
        <div>
          <form onSubmit={submit} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label htmlFor={`newsletter-email-${slug}`} className="sr-only">Email address</label>
            <input
              id={`newsletter-email-${slug}`}
              name="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email address"
              autoComplete="email"
              disabled={isPending}
              style={{ flex: "1 1 240px", minWidth: 0, padding: "13px 15px", borderRadius: 10, border: `1px solid ${border ?? `${color}24`}`, background: `${background}`, color, outline: "none", fontSize: 14 }}
            />
            <button type="submit" disabled={isPending} style={{ padding: "13px 20px", border: 0, borderRadius: 10, background: accent, color: "#fff", fontWeight: 800, fontSize: 13, cursor: isPending ? "wait" : "pointer", opacity: isPending ? .7 : 1 }}>
              {isPending ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
          <p aria-live="polite" style={{ minHeight: 20, margin: "10px 0 0", color: muted ?? `${color}99`, fontSize: 12 }}>{status}</p>
        </div>
      </div>
    </section>
  );
}
