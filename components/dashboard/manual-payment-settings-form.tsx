"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveManualPaymentSettings } from "@/lib/actions/manual-payment";

type Initial = {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  note: string;
  whatsapp: string;
  call: string;
};

const fieldClass = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--bn-admin-orange)]";

export function ManualPaymentSettingsForm({ slug, initial, canEdit }: { slug: string; initial: Initial; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Initial>(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Initial>) => setForm((f) => ({ ...f, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await saveManualPaymentSettings(slug, form);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Payment details saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-4 rounded-lg border bg-background p-5">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={form.enabled} disabled={!canEdit} onChange={(e) => set({ enabled: e.target.checked })} className="mt-1" />
        <span>
          <b>Accept payment by bank transfer</b>
          <span className="block text-xs text-muted-foreground">
            Customers see these details at checkout, transfer the money straight to you, and upload proof of payment (an image or a document). You confirm once it lands.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bank name</span>
          <input className={fieldClass} value={form.bankName} disabled={!canEdit} onChange={(e) => set({ bankName: e.target.value })} placeholder="e.g. GTBank" maxLength={80} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account number</span>
          <input className={fieldClass} value={form.accountNumber} disabled={!canEdit} onChange={(e) => set({ accountNumber: e.target.value })} placeholder="0123456789" inputMode="numeric" maxLength={34} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account name</span>
        <input className={fieldClass} value={form.accountName} disabled={!canEdit} onChange={(e) => set({ accountName: e.target.value })} placeholder="Name on the account" maxLength={120} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">WhatsApp number</span>
          <input className={fieldClass} value={form.whatsapp} disabled={!canEdit} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+234 801 234 5678" inputMode="tel" maxLength={25} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call line</span>
          <input className={fieldClass} value={form.call} disabled={!canEdit} onChange={(e) => set({ call: e.target.value })} placeholder="+234 809 876 5432" inputMode="tel" maxLength={25} />
        </label>
      </div>
      <div className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Customers see both next to your account details if confirming takes time. Add at least one.</span>
        {canEdit && (
          <button type="button" className="font-semibold underline" onClick={() => set({ call: form.whatsapp })}>
            Call line is the same as WhatsApp
          </button>
        )}
        <span className="block w-full">The call line is also your store&apos;s contact phone, so it appears in your storefront footer.</span>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note to customers (optional)</span>
        <textarea className={fieldClass} rows={2} value={form.note} disabled={!canEdit} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Orders are confirmed within 30 minutes, 8am to 8pm." maxLength={500} />
      </label>

      {canEdit ? (
        <button type="submit" disabled={busy} className="rounded-md bg-[var(--bn-admin-orange)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Saving…" : "Save payment details"}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">Your role can view these details but not change them.</p>
      )}
    </form>
  );
}
