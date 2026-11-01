"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { issueGiftCardAction, redeemGiftCardInStoreAction, setGiftCardStatusAction } from "@/lib/actions/gift-card";
import { currencySymbol, formatMoney } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";
import { TableScroll } from "@/components/ui/table-scroll";

export type GiftCardRow = {
  id: string;
  code: string;
  initialAmount: number;
  balance: number;
  status: "ACTIVE" | "DISABLED";
  expiresAt: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  createdAt: string;
};

const naira = (n: number) => `${formatMoney(n)}`;
const input = "rounded-md border px-3 py-1.5 text-sm";

export function GiftCardManager({ slug, cards }: { slug: string; cards: GiftCardRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const now = Date.now();

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setPending(true);
    try {
      return await fn();
    } catch {
      toast.error("Something went wrong. Please try again.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function onIssue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const res = await run(() => issueGiftCardAction(slug, data));
    if (!res) return;
    if (!res.success) return void toast.error(res.error);
    setIssuedCode(res.data.code);
    form.reset();
    toast.success("Gift card issued.");
    router.refresh();
  }

  async function onRedeem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const res = await run(() => redeemGiftCardInStoreAction(slug, data));
    if (!res) return;
    if (!res.success) return void toast.error(res.error);
    form.reset();
    toast.success(`${naira(res.data.redeemed)} deducted. ${naira(res.data.balanceAfter)} left on the card.`);
    router.refresh();
  }

  async function toggle(card: GiftCardRow) {
    const res = await run(() => setGiftCardStatusAction(slug, card.id, card.status === "ACTIVE" ? "DISABLED" : "ACTIVE"));
    if (!res) return;
    if (!res.success) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {issuedCode && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          <span>Give this code to the customer:</span>
          <code className="rounded bg-white px-2 py-1 font-mono text-base font-semibold">{issuedCode}</code>
          <button type="button" className="underline" onClick={() => navigator.clipboard?.writeText(issuedCode).then(() => toast.success("Copied"))}>
            Copy
          </button>
        </div>
      )}

      <form onSubmit={onIssue} className="grid grid-cols-2 gap-3 rounded-lg border bg-background p-4 sm:grid-cols-6">
        <h2 className="col-span-full text-sm font-semibold">Issue a gift card</h2>
        <input name="amount" type="number" min="1" step="any" placeholder={`Amount (${currencySymbol()})`} required className={input} />
        <input name="recipientName" placeholder="Recipient name" className={input} />
        <input name="recipientEmail" type="email" placeholder="Recipient email" className={input} />
        <input name="expiresAt" type="date" aria-label="Expiry date (optional)" className={input} />
        <input name="message" placeholder="Message (optional)" className={`${input} col-span-2 sm:col-span-1`} />
        <button disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Issue card</button>
      </form>

      <form onSubmit={onRedeem} className="grid grid-cols-2 gap-3 rounded-lg border bg-background p-4 sm:grid-cols-4">
        <h2 className="col-span-full text-sm font-semibold">Take a card as payment (in store)</h2>
        <input name="code" placeholder="GC-XXXX-XXXX-XXXX" required className={`${input} font-mono`} />
        <input name="amount" type="number" min="1" step="any" placeholder={`Amount to deduct (${currencySymbol()})`} required className={input} />
        <input name="note" placeholder="Note / receipt no. (optional)" className={input} />
        <button disabled={pending} className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50">Deduct</button>
      </form>

      <TableScroll className="rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Code</th><th className="px-4 py-2">Recipient</th><th className="px-4 py-2">Balance</th>
              <th className="px-4 py-2">Expires</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const expired = c.expiresAt ? new Date(c.expiresAt).getTime() < now : false;
              const label = c.status === "DISABLED" ? "Disabled" : expired ? "Expired" : c.balance <= 0 ? "Used up" : "Active";
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">{c.recipientName || c.recipientEmail || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">{naira(c.balance)} <span className="text-muted-foreground">/ {naira(c.initialAmount)}</span></td>
                  <td className="px-4 py-3">{c.expiresAt ? formatDate(new Date(c.expiresAt)) : "Never"}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{label}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" disabled={pending} onClick={() => toggle(c)} className="text-xs underline disabled:opacity-50">
                      {c.status === "ACTIVE" ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {cards.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No gift cards yet — issue one above.</td></tr>
            )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
