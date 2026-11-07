"use client";

import { useState, useTransition } from "react";
import { startWalletFunding } from "@/lib/actions/customer-wallet";
import { toast } from "sonner";
import { currencySymbol } from "@/lib/utils/format-money";

export function WalletFundingForm({ slug, modern = false }: { slug: string; modern?: boolean }) {
  const [amount, setAmount] = useState("10000");
  const [pending, startTransition] = useTransition();

  function submit() {
    const value = Number(amount);
    startTransition(async () => {
      const result = await startWalletFunding(slug, value);
      if (!result.success) { toast.error(result.error); return; }
      window.location.assign(result.data.authorizationUrl);
    });
  }

  if (modern) {
    return (
      <section className="acx-card acx-fund" aria-label="Add money">
        <h2>Add money</h2>
        <p>You&apos;ll be taken to our secure payment page to complete the top-up. A small payment processing fee is added there; your wallet is credited the full amount you enter.</p>
        <div className="acx-fund-row">
          <div className="acx-money"><span>{currencySymbol()}</span><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="10000" aria-label="Amount to add" /></div>
          <button type="button" onClick={submit} disabled={pending || !amount} className="acx-btn">{pending ? "Starting…" : "Fund wallet"}</button>
        </div>
        <div className="acx-presets" aria-label="Quick amounts">
          {[5000, 10000, 20000, 50000].map((v) => <button key={v} type="button" onClick={() => setAmount(String(v))}>{currencySymbol()}{v.toLocaleString("en-NG")}</button>)}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-950">Add money</h2>
      <p className="mt-1 text-sm text-slate-500">You will be sent to our secure payment page. A small payment processing fee is added there; your wallet is credited the full amount you enter.</p>
      <div className="mt-4 flex gap-3">
        <div className="relative flex-1"><span className="absolute left-3 top-2.5 text-sm text-slate-400">{currencySymbol()}</span><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-slate-400" placeholder="10000" /></div>
        <button onClick={submit} disabled={pending} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Starting…" : "Fund wallet"}</button>
      </div>
    </section>
  );
          }
