"use client";

import { useState, useTransition } from "react";
import { startTailoringBalancePayment } from "@/lib/actions/tailoring-public";

/** "Pay balance" on the customer's status page. The server decides what is owed and where the payment goes. */
export function TailoringPayButton({ slug, token, balance, currencyLabel, colors }: {
  slug: string; token: string; balance: number; currencyLabel: string; colors: { accent: string; onAccent: string; ink: string };
}) {
  const [amount, setAmount] = useState(String(balance));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const pay = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { setError("Enter a valid amount."); return; }
    setError("");
    start(async () => {
      const r = await startTailoringBalancePayment(slug, token, n);
      if (!r.success) { setError(r.error); return; }
      window.location.href = r.data.url;
    });
  };

  return (
    <div className="mt-4 grid gap-2">
      <label className="grid gap-1 text-xs font-semibold" style={{ opacity: 0.85 }}>
        Amount to pay ({currencyLabel})
        <input
          type="number" inputMode="decimal" min="1" max={balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${colors.ink}33`, background: "transparent", color: "inherit" }}
        />
      </label>
      <button onClick={pay} disabled={pending} className="rounded-full py-3 text-sm font-semibold" style={{ background: colors.accent, color: colors.onAccent, opacity: pending ? 0.7 : 1 }}>
        {pending ? "Opening payment…" : "Pay online"}
      </button>
      {error && <p role="alert" className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
