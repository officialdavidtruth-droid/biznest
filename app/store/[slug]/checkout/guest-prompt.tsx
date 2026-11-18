"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { continueAsGuest } from "@/lib/actions/guest-checkout";

/** Shown instead of the checkout when the buyer isn't signed in: a short nudge to sign up, with guest checkout as the easy way through. */
export function GuestPrompt({ slug, storeName, accent }: { slug: string; storeName: string; accent: string }) {
  const router = useRouter();
  const [guest, setGuest] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const next = encodeURIComponent(`/store/${slug}/checkout`);
  const qs = `callbackUrl=${next}&store=${encodeURIComponent(slug)}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await continueAsGuest(slug, form);
      if (!r.success) return setError(r.error);
      router.refresh();
    });
  }

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500";
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="guest-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
        {!guest ? (
          <>
            <h2 id="guest-title" className="text-lg font-bold">Create an account for {storeName}?</h2>
            <p className="mt-2 text-sm text-slate-600">Track your orders, view your order history and keep a wallet for faster payments.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Link href={`/register?${qs}`} style={{ background: accent }} className="rounded-lg px-4 py-3 text-center text-sm font-semibold text-white no-underline">Sign up</Link>
              <button type="button" onClick={() => setGuest(true)} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold">Proceed to checkout anyway</button>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">Already have an account? <Link href={`/login?${qs}`} className="font-semibold underline">Log in</Link></p>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 id="guest-title" className="text-lg font-bold">Your details</h2>
            <p className="mt-1 text-sm text-slate-600">We use these for your order and receipt.</p>
            <div className="mt-4 space-y-2.5">
              <input className={field} placeholder="Full name" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={field} type="email" placeholder="Email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className={field} type="tel" placeholder="Phone number" autoComplete="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={pending} style={{ background: accent }} className="mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? "One moment…" : "Continue to checkout"}</button>
            <button type="button" onClick={() => setGuest(false)} className="mt-2 w-full py-2 text-sm text-slate-500">Back</button>
          </form>
        )}
      </div>
    </div>
  );
}
