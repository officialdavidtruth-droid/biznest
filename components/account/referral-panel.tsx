"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyReferralCodeAction } from "@/lib/actions/referral";

export function ReferralPanel({
  slug,
  shareUrl,
  code,
  appliedCode,
}: {
  slug: string;
  shareUrl: string;
  code: string;
  appliedCode: boolean;
}) {
  const router = useRouter();
  const [entered, setEntered] = useState("");
  const [pending, setPending] = useState(false);

  function copy(text: string, what: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error("Couldn't copy — select it and copy manually."));
  }

  async function onApply(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await applyReferralCodeAction(slug, entered);
      if (!res.success) return void toast.error(res.error);
      toast.success("Referral code applied.");
      setEntered("");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Your referral code</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-wider">{code}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(code, "Code")} className="rounded-md border px-3 py-1.5 text-sm">Copy code</button>
          <button type="button" onClick={() => copy(shareUrl, "Link")} className="rounded-md border px-3 py-1.5 text-sm">Copy sign-up link</button>
        </div>
      </div>

      {!appliedCode && (
        <form onSubmit={onApply} className="rounded-lg border p-4">
          <label className="text-sm font-medium" htmlFor="ref-code">Were you referred by a friend?</label>
          <p className="text-xs text-muted-foreground">Enter their code before your first order.</p>
          <div className="mt-2 flex gap-2">
            <input id="ref-code" value={entered} onChange={(e) => setEntered(e.target.value)} placeholder="Friend's code" required className="flex-1 rounded-md border px-3 py-1.5 font-mono text-sm uppercase" />
            <button disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Apply</button>
          </div>
        </form>
      )}
    </div>
  );
}
