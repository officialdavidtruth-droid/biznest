"use client";

import { useState } from "react";
import { checkGiftCardBalance } from "@/lib/actions/gift-card";

export function GiftCardBalanceForm({ slug }: { slug: string }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await checkGiftCardBalance(slug, code);
      if (!res.success) return setMessage({ ok: false, text: res.error });
      const exp = res.data.expiresAt ? ` Expires ${new Date(res.data.expiresAt).toLocaleDateString()}.` : "";
      setMessage({ ok: true, text: `Balance: ₦${res.data.balance.toLocaleString()}.${exp}` });
    } catch {
      setMessage({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border p-4">
      <label className="text-sm font-medium" htmlFor="gc-code">Check a gift card balance</label>
      <div className="mt-2 flex gap-2">
        <input id="gc-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="GC-XXXX-XXXX-XXXX" required className="flex-1 rounded-md border px-3 py-1.5 font-mono text-sm uppercase" />
        <button disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Check</button>
      </div>
      {message && <p className={`mt-2 text-sm ${message.ok ? "" : "text-destructive"}`} role="status">{message.text}</p>}
    </form>
  );
}
