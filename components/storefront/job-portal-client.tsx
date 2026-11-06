"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToEstimate, startJobPayment } from "@/lib/actions/job-portal";

type Colors = { accent: string; onAccent: string; ink: string };

export function JobPayButton({ slug, token, chargeId, colors }: { slug: string; token: string; chargeId: string; colors: Colors }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const pay = () => {
    setError("");
    start(async () => {
      const r = await startJobPayment(slug, token, chargeId);
      if (!r.success) { setError(r.error); return; }
      window.location.href = r.data.url;
    });
  };
  return (
    <div className="mt-2">
      <button onClick={pay} disabled={pending} className="rounded-full px-4 py-2 text-xs font-semibold" style={{ background: colors.accent, color: colors.onAccent, opacity: pending ? 0.7 : 1 }}>{pending ? "Opening payment…" : "Pay now"}</button>
      {error && <p role="alert" className="mt-1 text-xs" style={{ color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}

export function EstimateButtons({ slug, token, colors }: { slug: string; token: string; colors: Colors }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const answer = (approve: boolean) => {
    setError("");
    start(async () => { const r = await respondToEstimate(slug, token, approve); if (!r.success) { setError(r.error); return; } router.refresh(); });
  };
  return (
    <div className="mt-3 flex gap-2">
      <button disabled={pending} onClick={() => answer(true)} className="flex-1 rounded-full py-2.5 text-sm font-semibold" style={{ background: colors.accent, color: colors.onAccent, opacity: pending ? 0.7 : 1 }}>Approve</button>
      <button disabled={pending} onClick={() => confirm("Decline this estimate?") && answer(false)} className="flex-1 rounded-full py-2.5 text-sm font-semibold" style={{ border: `1px solid ${colors.ink}33` }}>Decline</button>
      {error && <p role="alert" className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
