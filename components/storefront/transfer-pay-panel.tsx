"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import type { StorePalette } from "@/lib/store-palette-defaults";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toFixed(2)}`; }
}

/** The store's account number and the exact amount to send. Refreshes itself so the customer is moved on once the transfer lands. */
export function TransferPayPanel(props: {
  slug: string; orderId: string; orderCode: string; amount: number; currency: string;
  bankName: string; accountNumber: string; accountName: string; expiresAt: string; palette: StorePalette;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const { palette } = props;

  // The page redirects to the confirmation as soon as the order is paid, so a refresh is all the "check" needs.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [router]);

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Couldn't copy"); }
  }
  function check() {
    setChecking(true);
    router.refresh();
    setTimeout(() => setChecking(false), 2500);
  }

  const box = { background: palette.card ?? "#fff", border: `1px solid ${palette.ink}1f`, borderRadius: 16 } as const;
  const copyBtn = { border: `1px solid ${palette.ink}26`, color: palette.ink } as const;

  return (
    <div className="space-y-4">
      <div style={box} className="p-5">
        <p className="text-xs font-semibold" style={{ opacity: 0.6 }}>Send exactly</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-3xl font-extrabold tabular-nums">{money(props.amount, props.currency)}</p>
          <button type="button" onClick={() => copy(props.amount.toFixed(2), "Amount")} aria-label="Copy amount" style={copyBtn} className="grid h-11 w-11 shrink-0 place-items-center rounded-full"><Copy className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-xs" style={{ opacity: 0.7 }}>Send this exact amount, including the kobo, so we can match your payment to this order.</p>
      </div>

      <div style={box} className="p-5">
        <p className="text-xs font-semibold" style={{ opacity: 0.6 }}>Account number</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-3xl font-extrabold tabular-nums tracking-wide">{props.accountNumber}</p>
          <button type="button" onClick={() => copy(props.accountNumber, "Account number")} aria-label="Copy account number" style={copyBtn} className="grid h-11 w-11 shrink-0 place-items-center rounded-full"><Copy className="h-4 w-4" /></button>
        </div>
        <p className="mt-3 text-sm font-semibold">{props.accountName}</p>
        <p className="text-sm" style={{ opacity: 0.7 }}>{props.bankName}</p>
      </div>

      <button type="button" onClick={check} disabled={checking} style={{ background: palette.accent, color: palette.onAccent }} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-70">
        {checking ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</> : "I've sent the money"}
      </button>
      <p className="text-center text-xs" style={{ opacity: 0.7 }}>
        This page updates by itself once your payment arrives, usually within a minute. Keep it open or come back to your order #{props.orderCode} later.
        Your transfer is held for this order for 48 hours.
      </p>
    </div>
  );
}
