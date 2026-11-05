"use client";

import { useState, useTransition } from "react";
import { startRentPayment, submitTenantMaintenance } from "@/lib/actions/rent-portal";

export function RentPayButton({ slug, token, chargeId, colors }: { slug: string; token: string; chargeId: string; colors: { accent: string; onAccent: string } }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const pay = () => {
    setError("");
    start(async () => {
      const r = await startRentPayment(slug, token, chargeId);
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

export function MaintenanceForm({ slug, token, colors }: { slug: string; token: string; colors: { accent: string; onAccent: string; ink: string } }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const field = { border: `1px solid ${colors.ink}33`, background: "transparent", color: "inherit" } as const;
  const send = () => {
    setMsg(null);
    start(async () => {
      const r = await submitTenantMaintenance(slug, token, { title, detail });
      if (!r.success) { setMsg({ ok: false, text: r.error }); return; }
      setTitle(""); setDetail("");
      setMsg({ ok: true, text: "Sent. Your landlord has been told." });
    });
  };
  return (
    <div className="mt-3 grid gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="What needs fixing? e.g. Kitchen tap leaking" aria-label="What needs fixing" className="rounded-lg px-3 py-2 text-sm" style={field} />
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={1000} rows={3} placeholder="Any details (optional)" aria-label="Details" className="rounded-lg px-3 py-2 text-sm" style={field} />
      <button onClick={send} disabled={pending || !title.trim()} className="rounded-full py-2.5 text-sm font-semibold" style={{ background: colors.accent, color: colors.onAccent, opacity: pending || !title.trim() ? 0.6 : 1 }}>
        {pending ? "Sending…" : "Report a problem"}
      </button>
      {msg && <p role={msg.ok ? "status" : "alert"} className="text-xs" style={{ color: msg.ok ? undefined : "#b91c1c" }}>{msg.text}</p>}
    </div>
  );
}
