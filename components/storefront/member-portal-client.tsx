"use client";

import { useState, useTransition } from "react";
import { startGiving, startMemberPayment } from "@/lib/actions/member-portal";

type Colors = { accent: string; onAccent: string; ink: string };

export function MemberPayButton({ slug, token, chargeId, colors }: { slug: string; token: string; chargeId: string; colors: Colors }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const pay = () => {
    setError("");
    start(async () => {
      const r = await startMemberPayment(slug, token, chargeId);
      if (!r.success) { setError(r.error); return; }
      window.location.href = r.data.url;
    });
  };
  return (
    <div className="mt-2">
      <button onClick={pay} disabled={pending} className="rounded-full px-4 py-2 text-xs font-semibold" style={{ background: colors.accent, color: colors.onAccent, opacity: pending ? 0.7 : 1 }}>
        {pending ? "Opening payment…" : "Pay now"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs" style={{ color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}

export function GiveForm({ slug, funds, colors }: { slug: string; funds: string[]; colors: Colors }) {
  const [fund, setFund] = useState(funds[0] ?? "General");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const field = { border: `1px solid ${colors.ink}33`, background: "transparent", color: "inherit" } as const;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await startGiving(slug, { fund, amount: Number(amount), name, email });
      if (!r.success) { setError(r.error); return; }
      window.location.href = r.data.url;
    });
  };
  return (
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="grid gap-1 text-xs font-semibold">Giving to
        <select value={fund} onChange={(e) => setFund(e.target.value)} className="rounded-lg px-3 py-2 text-sm font-normal" style={field}>{funds.map((f) => <option key={f}>{f}</option>)}</select>
      </label>
      <label className="grid gap-1 text-xs font-semibold">Amount (₦)
        <input type="number" inputMode="decimal" min="100" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" className="rounded-lg px-3 py-2 text-sm font-normal" style={field} />
      </label>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Your name (optional)" aria-label="Your name" className="rounded-lg px-3 py-2 text-sm" style={field} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} type="email" placeholder="Email for your receipt (optional)" aria-label="Email" className="rounded-lg px-3 py-2 text-sm" style={field} />
      <button disabled={pending} className="rounded-full py-3 text-sm font-semibold" style={{ background: colors.accent, color: colors.onAccent, opacity: pending ? 0.7 : 1 }}>{pending ? "Opening payment…" : "Give now"}</button>
      {error && <p role="alert" className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}
    </form>
  );
}
