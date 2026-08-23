"use client";

import { useState, type FormEvent } from "react";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

export function BuilderNewsletterForm({ storeSlug, accent }: { storeSlug: string; accent: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setStatus(null);
    const fd = new FormData(e.currentTarget); const result = await subscribeToNewsletter(storeSlug, fd);
    setBusy(false);
    if (!result.success) { setStatus(result.error); return; }
    setEmail(""); setStatus("You're subscribed. Thank you!");
  }

  return <form onSubmit={submit} style={{ display: "flex", gap: 8, maxWidth: 520, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
    <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" style={{ flex: "1 1 240px", minHeight: 44, borderRadius: 10, border: "1px solid #ffffff33", background: "#ffffff12", color: "inherit", padding: "0 14px", outline: "none" }} />
    <button disabled={busy} type="submit" style={{ minHeight: 44, padding: "0 18px", border: 0, borderRadius: 10, background: accent, color: "#fff", fontWeight: 800 }}>{busy ? "Joining…" : "Subscribe"}</button>
    {status && <div style={{ width: "100%", fontSize: 12, opacity: .8 }}>{status}</div>}
  </form>;
}
