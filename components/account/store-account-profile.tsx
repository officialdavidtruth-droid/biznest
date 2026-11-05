"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateStoreCustomerDetails } from "@/lib/actions/account";

type Props = {
  slug: string;
  storeName: string;
  user: { name?: string | null; email?: string | null; phone?: string | null; createdAt?: string | Date | null };
  stats: { label: string; value: string | number }[];
  links: { href: string; label: string; hint: string }[];
  location: string | null;
  memberSince: string;
};

const input = "mt-1 w-full rounded-lg border border-[#ddd7cc] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#052a23]";

export function StoreAccountProfile({ slug, storeName, user, stats, links, location, memberSince }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [shown, setShown] = useState({ name: user.name ?? "", phone: user.phone ?? "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const r = await updateStoreCustomerDetails(slug, { name, phone });
    if (r.success) { setShown({ name: name.trim(), phone: phone.trim() }); setEditing(false); setMsg({ ok: true, text: "Your details were saved." }); }
    else setMsg({ ok: false, text: r.error });
  });

  const display = shown.name || user.email || "Customer";
  return (
    <div className="veloura-account-content">
      <section className="veloura-panel" style={{ marginBottom: 12 }}>
        <div className="veloura-panel-head" style={{ marginBottom: 0 }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: ".08em", color: "#888", margin: 0 }}>WELCOME BACK</p>
            <h1 style={{ font: "400 28px Georgia,serif", margin: "4px 0 0" }}>{display}</h1>
            <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>Your account with {storeName}.</p>
          </div>
        </div>
      </section>

      <div className="veloura-stat-grid">
        {stats.map((s) => (
          <div className="veloura-stat" key={s.label}><div><h3>{s.value}</h3><p style={{ fontSize: 12 }}>{s.label}</p></div></div>
        ))}
      </div>

      <div className="veloura-panel-grid">
        <section className="veloura-panel">
          <div className="veloura-panel-head">
            <h2>Personal information</h2>
            {!editing && <button type="button" onClick={() => { setMsg(null); setEditing(true); }} style={{ fontSize: 13, color: "#765323", background: "none", border: 0, cursor: "pointer" }}>Edit</button>}
          </div>
          {msg && <p role="status" style={{ fontSize: 13, margin: "0 0 10px", color: msg.ok ? "#35714c" : "#b42318" }}>{msg.text}</p>}
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: "grid", gap: 12 }}>
              <label style={{ fontSize: 13 }}>Full name<input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" /></label>
              <label style={{ fontSize: 13 }}>Phone number<input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" /></label>
              <label style={{ fontSize: 13 }}>Email<input className={input} value={user.email ?? ""} disabled readOnly /><span style={{ fontSize: 11, color: "#888" }}>Your email is your sign-in and can&apos;t be changed here.</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={pending} className="veloura-gold-btn">{pending ? "Saving…" : "Save changes"}</button>
                <button type="button" disabled={pending} onClick={() => { setEditing(false); setName(shown.name); setPhone(shown.phone); setMsg(null); }} className="veloura-search">Cancel</button>
              </div>
            </form>
          ) : (
            <dl className="veloura-detail-list">
              <div><dt>Full name</dt><dd style={{ fontSize: 14 }}>{display}</dd></div>
              <div><dt>Email</dt><dd style={{ fontSize: 14 }}>{user.email || "—"}</dd></div>
              <div><dt>Phone</dt><dd style={{ fontSize: 14 }}>{shown.phone || "Not set"}</dd></div>
              <div><dt>Member since</dt><dd style={{ fontSize: 14 }}>{memberSince}</dd></div>
              <div><dt>Default address</dt><dd style={{ fontSize: 14 }}>{location || "Not set"}</dd></div>
            </dl>
          )}
        </section>

        <section className="veloura-panel">
          <div className="veloura-panel-head"><h2>Quick links</h2></div>
          <div style={{ display: "grid", gap: 8 }}>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="veloura-list-card" style={{ textDecoration: "none", color: "inherit", marginBottom: 0 }}>
                <strong style={{ fontSize: 14 }}>{l.label}</strong>
                <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{l.hint}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
