"use client";

import { useState, useTransition } from "react";
import { createWalletPaymentRequest } from "@/lib/actions/customer-wallet";
import { toast } from "sonner";

export function WalletPaymentQrButton({ slug, bookingId }: { slug: string; bookingId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await createWalletPaymentRequest(slug, bookingId); if (!result.success) { toast.error(result.error); return; } setUrl(result.data.url); })} className="mt-2 ml-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{pending ? "Generating…" : "Show payment QR"}</button>
      {url && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5" onClick={() => setUrl(null)}><div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}><h3 className="text-lg font-bold text-slate-950">Payment QR</h3><p className="mt-1 text-sm text-slate-500">Let the business scan this code. It expires in 10 minutes.</p><div className="mx-auto mt-5 w-fit rounded-2xl border border-slate-100 bg-white p-3"><img alt="Wallet payment QR" width={240} height={240} src={`https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=240&margin=2`} /></div><button type="button" onClick={() => navigator.clipboard?.writeText(url)} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">Copy payment link</button><button type="button" onClick={() => setUrl(null)} className="ml-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white">Close</button></div></div>}
    </>
  );
}
