"use client";

import { useState, useTransition } from "react";
import { deleteMyStoreAccount } from "@/lib/actions/account";

/** Download-my-data link and account deletion, for any store customer account. */
export function PrivacyPanel({ slug, storeName }: { slug: string; storeName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const remove = () => start(async () => {
    const r = await deleteMyStoreAccount(slug, password);
    if (r.success) window.location.href = `/store/${slug}`;
    else setError(r.error);
  });

  return (
    <section className="veloura-panel" style={{ marginTop: 12 }}>
      <div className="veloura-panel-head"><h2>Privacy &amp; data</h2></div>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px" }}>You can download a copy of what {storeName} holds about you, or delete your account.</p>
      <a href={`/api/store/${slug}/account/export`} className="veloura-gold-btn" style={{ textDecoration: "none" }}>Download my data</a>
      <div style={{ marginTop: 18, borderTop: "1px solid #eee9e1", paddingTop: 14 }}>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} style={{ fontSize: 13, color: "#b42318", background: "none", border: 0, cursor: "pointer", padding: 0 }}>Delete my account…</button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setError(null); remove(); }} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
            <p style={{ fontSize: 13, margin: 0 }}>This removes your details, addresses and saved items from {storeName} and can&apos;t be undone. Past order and booking records are kept without your name, because the business needs them for its accounts.</p>
            <label style={{ fontSize: 13 }}>Confirm with your password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required style={{ display: "block", marginTop: 4, width: "100%", border: "1px solid #ddd7cc", borderRadius: 8, padding: "10px 12px", fontSize: 14 }} />
            </label>
            {error && <p role="alert" style={{ fontSize: 13, color: "#b42318", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={pending || !password} style={{ background: "#b42318", color: "#fff", border: 0, borderRadius: 8, padding: "10px 14px", fontSize: 13, opacity: pending || !password ? 0.6 : 1 }}>{pending ? "Deleting…" : "Permanently delete my account"}</button>
              <button type="button" disabled={pending} onClick={() => { setOpen(false); setPassword(""); setError(null); }} className="veloura-search">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
