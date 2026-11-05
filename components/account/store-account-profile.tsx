"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Wallet, Package, CalendarDays, Heart, Sparkles, MapPin, MessageCircle, Mail, Phone, CalendarCheck } from "lucide-react";
import { updateStoreCustomerDetails } from "@/lib/actions/account";
import { PrivacyPanel } from "@/components/account/privacy-panel";

type Props = {
  slug: string;
  storeName: string;
  user: { name?: string | null; email?: string | null; phone?: string | null; createdAt?: string | Date | null };
  stats: { label: string; value: string | number }[];
  links: { href: string; label: string; hint: string }[];
  location: string | null;
  memberSince: string;
};

// Pick an icon from the link/stat it belongs to; anything unknown gets a neutral one.
function iconFor(label: string) {
  const l = label.toLowerCase();
  if (/wallet/.test(l)) return Wallet;
  if (/order|invoice|purchase|project/.test(l)) return Package;
  if (/book|reserv|appoint/.test(l)) return CalendarDays;
  if (/save|wish/.test(l)) return Heart;
  if (/reward|point/.test(l)) return Sparkles;
  if (/address/.test(l)) return MapPin;
  if (/support|message/.test(l)) return MessageCircle;
  return Sparkles;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

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
      <section className="acx-hero" aria-label="Your account">
        <div className="acx-avatar" aria-hidden="true">{initials(display)}</div>
        <div className="acx-hero-copy">
          <small>Welcome back</small>
          <h1>{display}</h1>
          <div className="acx-chips">
            <span className="acx-chip"><CalendarCheck size={13} /> Member since {memberSince}</span>
            {location ? <span className="acx-chip"><MapPin size={13} /> {location}</span> : null}
          </div>
        </div>
      </section>

      <div className="acx-tiles">
        {stats.map((s) => {
          const Icon = iconFor(s.label);
          return (
            <div className="acx-tile" key={s.label}>
              <span className="acx-tile-ico"><Icon size={20} strokeWidth={1.9} /></span>
              <div><b>{s.value}</b><span>{s.label}</span></div>
            </div>
          );
        })}
      </div>

      <div className="veloura-panel-grid">
        <section className="veloura-panel">
          <div className="veloura-panel-head">
            <h2>Personal information</h2>
            {!editing && <button type="button" className="acx-edit" onClick={() => { setMsg(null); setEditing(true); }}>Edit</button>}
          </div>
          {msg && <p role="status" className={`acx-msg ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="acx-form">
              <label className="acx-field">Full name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" /></label>
              <label className="acx-field">Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" /></label>
              <label className="acx-field">Email<input value={user.email ?? ""} disabled readOnly /><small>Your email is your sign-in and can&apos;t be changed here.</small></label>
              <div className="acx-row">
                <button type="submit" disabled={pending} className="acx-btn">{pending ? "Saving…" : "Save changes"}</button>
                <button type="button" disabled={pending} onClick={() => { setEditing(false); setName(shown.name); setPhone(shown.phone); setMsg(null); }} className="acx-btn-ghost">Cancel</button>
              </div>
            </form>
          ) : (
            <dl className="veloura-detail-list">
              <div><dt>Full name</dt><dd>{display}</dd></div>
              <div><dt><Mail size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />Email</dt><dd>{user.email || "—"}</dd></div>
              <div><dt><Phone size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />Phone</dt><dd>{shown.phone || "Not set"}</dd></div>
              <div><dt>Default address</dt><dd>{location || "Not set"}</dd></div>
            </dl>
          )}
        </section>

        <section className="veloura-panel">
          <div className="veloura-panel-head"><h2>Quick links</h2></div>
          <div style={{ display: "grid", gap: 10 }}>
            {links.map((l) => {
              const Icon = iconFor(l.label);
              return (
                <Link key={l.href} href={l.href} className="acx-action">
                  <span className="acx-tile-ico"><Icon size={18} strokeWidth={1.9} /></span>
                  <div><strong>{l.label}</strong><span>{l.hint}</span></div>
                  <ChevronRight size={16} />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
      <PrivacyPanel slug={slug} storeName={storeName} />
    </div>
  );
}
