"use client";

import { useState, useTransition } from "react";
import { setGuestPassword } from "@/lib/actions/order-lookup";

/** After paying as a guest: one field to turn the order history into a real account. */
export function GuestPasswordPrompt({ slug }: { slug: string }) {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (msg?.ok) return <section style={{ maxWidth: 640, margin: "1rem auto", padding: "1rem 1.25rem", border: "1px solid rgba(0,0,0,.12)", borderRadius: 12, background: "#fff", color: "#111" }}><b>Account saved.</b> You can now log in anytime with your email and password to see all your orders.</section>;
  return (
    <section style={{ maxWidth: 640, margin: "1rem auto", padding: "1rem 1.25rem", border: "1px solid rgba(0,0,0,.12)", borderRadius: 12, background: "#fff", color: "#111" }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>See all your orders in one place</h2>
      <p style={{ fontSize: 14, margin: "4px 0 10px", color: "#555" }}>Set a password to keep your orders and wallet for next time.</p>
      <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); setMsg(null); start(async () => { const r = await setGuestPassword(slug, pw); setMsg(r.success ? { ok: true, text: "" } : { ok: false, text: r.error }); }); }}>
        <input type="password" autoComplete="new-password" minLength={8} required placeholder="Choose a password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ flex: "1 1 180px", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 }} />
        <button type="submit" disabled={pending} style={{ padding: "10px 16px", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 600, fontSize: 14 }}>{pending ? "Saving…" : "Save"}</button>
      </form>
      {msg && !msg.ok && <p role="alert" style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{msg.text}</p>}
    </section>
  );
}
