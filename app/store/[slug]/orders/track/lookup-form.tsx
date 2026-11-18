"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findOrderToTrack } from "@/lib/actions/order-lookup";

export function OrderLookupForm({ slug, storeName, accent }: { slug: string; storeName: string; accent: string }) {
  const router = useRouter();
  const [num, setNum] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-5 py-10 text-slate-900">
      <h1 className="text-xl font-bold">Track your order</h1>
      <p className="mt-1 text-sm text-slate-600">Enter the order number from your receipt and the email you used at {storeName}.</p>
      <form className="mt-5 space-y-2.5" onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => { const r = await findOrderToTrack(slug, num, email); if (!r.success) return setError(r.error); router.push(r.data.path); }); }}>
        <input className={field} placeholder="Order number (e.g. 3F9K2A1B)" autoCapitalize="characters" required value={num} onChange={(e) => setNum(e.target.value)} />
        <input className={field} type="email" placeholder="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={pending} style={{ background: accent }} className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Looking…" : "Track order"}</button>
      </form>
    </main>
  );
}
