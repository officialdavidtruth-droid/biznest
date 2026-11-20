"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Landmark, Loader2 } from "lucide-react";
import { createStoreVirtualAccount, type StoreVirtualAccountView } from "@/lib/actions/virtual-account";

const field = "h-12 w-full rounded-xl border bg-background px-3.5 text-[15px] outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.25)]";

/** A permanent bank account number for the store. Customers can pay it by plain bank transfer; the money is paid out to the connected bank account. */
export function DedicatedAccountCard({ slug, accounts }: { slug: string; accounts: StoreVirtualAccountView[] }) {
  const [list, setList] = useState(accounts);
  const [idType, setIdType] = useState<"BVN" | "NIN">("BVN");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const res = await createStoreVirtualAccount(slug, { idType, idNumber, phone, consent });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    setList((l) => [res.data, ...l]);
    setIdNumber("");
    toast.success(res.data.pending ? "Request sent. Your account number will appear here shortly." : "Your account number is ready.");
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast.error("Couldn't copy"); }
  }

  return (
    <div className="max-w-xl rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(var(--primary)/0.1)] text-primary"><Landmark className="h-[18px] w-[18px]" /></span>
        <div>
          <h2 className="text-base font-semibold">Your account number</h2>
          <p className="text-xs text-muted-foreground">A bank account number just for your store</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted/60 p-3.5 text-sm">
        <p className="font-semibold">How it works</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Customers send money to this account number. The account name shows your store name.</li>
          <li>BizNest receives it, takes any fee on your plan, and sends the rest to the bank account you connected above.</li>
          <li>This number is only for receiving. Your money never stays here, so no need to withdraw from it.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">Connect your bank account above first. If you haven't, payouts wait and are sent once you connect it.</p>
      </div>

      {list.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {list.map((a) => (
            <li key={a.id} className="rounded-xl border p-3.5">
              {a.pending ? (
                <p className="text-sm text-muted-foreground">Setting up your account number. This can take a few minutes; refresh this page shortly.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{a.bankName}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="text-2xl font-bold tabular-nums tracking-wide">{a.accountNumber}</p>
                    <button type="button" onClick={() => copy(a.accountNumber)} aria-label="Copy account number" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border hover:bg-muted"><Copy className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.accountName}</p>
                </>
              )}
            </li>
          ))}
          <li className="text-xs text-muted-foreground">Share this number with customers. Whatever they send is paid out to your connected bank account.</li>
        </ul>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Get an account number customers can pay by simple bank transfer. We need your ID once to open it; it is sent to our payment partner and is not saved by BizNest.</p>
          <div className="grid grid-cols-2 gap-2">
            {(["BVN", "NIN"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setIdType(t)} className={`h-11 rounded-xl border text-sm font-semibold ${idType === t ? "border-primary bg-[hsl(var(--primary)/0.1)] text-primary" : ""}`}>{t}</button>
            ))}
          </div>
          <input className={field} inputMode="numeric" autoComplete="off" data-lpignore="true" maxLength={11} placeholder={`Your 11-digit ${idType}`} value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ""))} />
          <input className={field} inputMode="tel" autoComplete="tel" placeholder="Phone number (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>I agree that my {idType} is used once to open this account with BizNest&apos;s payment partner.</span>
          </label>
          <button type="button" onClick={open} disabled={busy || !consent || idNumber.length !== 11} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Get my account number
          </button>
        </div>
      )}
    </div>
  );
}
