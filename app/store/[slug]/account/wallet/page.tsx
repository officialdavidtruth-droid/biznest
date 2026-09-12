import { getWallet } from "@/lib/actions/customer-wallet";
import { WalletFundingForm } from "@/components/storefront/wallet-funding-form";
import { redirect } from "next/navigation";

export default async function WalletPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const wallet = await getWallet(slug);
  if (!wallet) redirect(`/login?store=${encodeURIComponent(slug)}&callbackUrl=/store/${encodeURIComponent(slug)}/account/wallet`);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Customer wallet</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Wallet</h1>
        <p className="mt-2 text-sm text-slate-500">Keep money here and use it to pay for eligible bookings without stopping at the front desk.</p>
      </div>
      <section className="rounded-3xl p-6 text-white shadow-lg" style={{ background: "var(--sig-accent, #0f172a)" }}>
        <p className="text-sm text-white/60">Available balance</p>
        <p className="mt-2 text-4xl font-bold">₦{Number(wallet.balance).toLocaleString()}</p>
        <p className="mt-3 text-xs text-white/50">{wallet.currency} · Wallet funds are store-scoped.</p>
      </section>
      <WalletFundingForm slug={slug} />
      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-950">Recent activity</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {wallet.transactions.length === 0 ? <p className="p-6 text-sm text-slate-500">No wallet activity yet.</p> : wallet.transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-b-0">
              <div><p className="text-sm font-semibold text-slate-800">{tx.type === "FUNDING" ? "Wallet funding" : tx.type === "PAYMENT" ? "Booking payment" : tx.type}</p><p className="mt-1 text-xs text-slate-400">{tx.reference}</p></div>
              <div className="text-right"><p className={`text-sm font-bold ${Number(tx.amount) >= 0 ? "text-emerald-600" : "text-slate-900"}`}>{Number(tx.amount) >= 0 ? "+" : "−"}₦{Math.abs(Number(tx.amount)).toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">Balance ₦{Number(tx.balanceAfter).toLocaleString()}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

