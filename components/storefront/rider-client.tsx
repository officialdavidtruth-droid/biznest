"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { riderDelivered, riderFailed, riderPickedUp } from "@/lib/actions/rider-portal";

type Colors = { accent: string; onAccent: string; ink: string };

export function RiderJobActions({ slug, token, id, status, cod, colors }: { slug: string; token: string; id: string; status: string; cod: number; colors: Colors }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"" | "deliver" | "fail">("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const field = { border: `1px solid ${colors.ink}33`, background: "transparent", color: "inherit" } as const;
  const go = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError("");
    start(async () => { const r = await fn(); if (!r.success) { setError(r.error ?? "Something went wrong."); return; } setMode(""); setPin(""); router.refresh(); });
  };
  const primary = { background: colors.accent, color: colors.onAccent } as const;
  return (
    <div className="mt-3 space-y-2">
      {status === "ASSIGNED" && <button disabled={pending} onClick={() => go(() => riderPickedUp(slug, token, id))} className="w-full rounded-full py-3 text-sm font-semibold" style={primary}>I&rsquo;ve picked it up</button>}
      {status === "PICKED_UP" && mode === "" && <button onClick={() => setMode("deliver")} className="w-full rounded-full py-3 text-sm font-semibold" style={primary}>Deliver</button>}
      {mode === "deliver" && (
        <div className="grid gap-2">
          {cod > 0 && <p className="rounded-lg p-3 text-sm font-bold" style={field}>Collect ₦{Math.round(cod).toLocaleString("en-NG")} cash</p>}
          <input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="Customer's 4-digit code" aria-label="Delivery code" className="rounded-lg px-3 py-3 text-center text-lg tracking-widest" style={field} />
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Who received it? (optional)" aria-label="Received by" className="rounded-lg px-3 py-2 text-sm" style={field} />
          <button disabled={pending || pin.length !== 4} onClick={() => go(() => riderDelivered(slug, token, id, { pin, recipientName: name }))} className="rounded-full py-3 text-sm font-semibold" style={{ ...primary, opacity: pending || pin.length !== 4 ? 0.6 : 1 }}>Confirm delivered</button>
          <button onClick={() => setMode("")} className="text-xs underline">Back</button>
        </div>
      )}
      {(status === "ASSIGNED" || status === "PICKED_UP") && mode !== "deliver" && (
        mode === "fail" ? (
          <div className="grid gap-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Why? e.g. customer not reachable" aria-label="Reason" className="rounded-lg px-3 py-2 text-sm" style={field} />
            <button disabled={pending || !reason.trim()} onClick={() => go(() => riderFailed(slug, token, id, reason))} className="rounded-full py-2 text-xs font-semibold" style={field}>Mark as failed</button>
            <button onClick={() => setMode("")} className="text-xs underline">Back</button>
          </div>
        ) : <button onClick={() => setMode("fail")} className="w-full text-xs underline">Couldn&rsquo;t deliver</button>
      )}
      {error && <p role="alert" className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
