"use client";

import { useState, useTransition } from "react";
import { buyTickets } from "@/lib/actions/ticket-public";

type Tier = { id: string; name: string; price: number; left: number; max: number; state: "ON_SALE" | "SOLD_OUT" | "SALE_ENDED" | "OFF" };
type Colors = { accent: string; onAccent: string; ink: string };

export function TicketBuyForm({ slug, eventId, tiers, colors }: { slug: string; eventId: string; tiers: Tier[]; colors: Colors }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const field = { border: `1px solid ${colors.ink}33`, background: "transparent", color: "inherit" } as const;
  const total = tiers.reduce((s, t) => s + (qty[t.id] ?? 0) * t.price, 0);
  const count = tiers.reduce((s, t) => s + (qty[t.id] ?? 0), 0);
  const ngn = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
  const set = (t: Tier, v: number) => setQty({ ...qty, [t.id]: Math.max(0, Math.min(v, t.max, t.left)) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await buyTickets(slug, { eventId, lines: tiers.map((t) => ({ tierId: t.id, qty: qty[t.id] ?? 0 })).filter((l) => l.qty > 0), name, email, phone });
      if (!r.success) { setError(r.error); return; }
      window.location.href = r.data.url;
    });
  };
  return (
    <form onSubmit={submit} className="mt-4 grid gap-4">
      <ul className="space-y-3">
        {tiers.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
            <span><b>{t.name}</b><span className="block text-xs" style={{ opacity: 0.7 }}>{t.price > 0 ? ngn(t.price) : "Free"}{t.state === "ON_SALE" && t.left <= 10 ? ` · only ${t.left} left` : ""}{t.state === "SOLD_OUT" ? " · sold out" : t.state === "SALE_ENDED" ? " · sales ended" : ""}</span></span>
            {t.state === "ON_SALE" ? (
              <span className="flex items-center gap-2">
                <button type="button" aria-label={`Fewer ${t.name}`} onClick={() => set(t, (qty[t.id] ?? 0) - 1)} className="h-8 w-8 rounded-full" style={field}>−</button>
                <b className="w-6 text-center">{qty[t.id] ?? 0}</b>
                <button type="button" aria-label={`More ${t.name}`} onClick={() => set(t, (qty[t.id] ?? 0) + 1)} className="h-8 w-8 rounded-full" style={field}>+</button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {count > 0 && (
        <div className="grid gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Your name" aria-label="Your name" className="rounded-lg px-3 py-2 text-sm" style={field} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} type="email" placeholder="Email (your tickets are sent here)" aria-label="Email" className="rounded-lg px-3 py-2 text-sm" style={field} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="Phone (optional)" aria-label="Phone" className="rounded-lg px-3 py-2 text-sm" style={field} />
        </div>
      )}
      <button disabled={pending || count === 0} className="rounded-full py-3 text-sm font-semibold" style={{ background: colors.accent, color: colors.onAccent, opacity: pending || count === 0 ? 0.6 : 1 }}>
        {pending ? "Please wait…" : count === 0 ? "Choose tickets" : total > 0 ? `Pay ${ngn(total)}` : "Get free tickets"}
      </button>
      {error && <p role="alert" className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}
    </form>
  );
}
