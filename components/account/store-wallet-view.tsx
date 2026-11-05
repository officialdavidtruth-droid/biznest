import { ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";
import { WalletFundingForm } from "@/components/storefront/wallet-funding-form";
import { formatMoney } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";


const TXN_LABEL: Record<string, string> = { FUNDING: "Wallet top-up", PAYMENT: "Payment", REFUND: "Refund", ADJUSTMENT: "Adjustment" };

export function ModernWallet({ slug, wallet }: { slug: string; wallet: { currency?: string | null; balance: unknown; transactions: any[] } }) {
  const currency = wallet.currency || "NGN";
  return (
    <div className="veloura-account-content">
      <section className="bn-account-hero"><h1>Wallet</h1><p>Store credit you can spend on orders and bookings with this store.</p></section>
      <div className="acx-wallet">
        <section className="acx-balance" aria-label="Wallet balance">
          <div><small>Available balance</small><strong>{formatMoney(Number(wallet.balance), currency)}</strong></div>
          <p>Only usable at this store. Pay from it at checkout.</p>
        </section>
        <WalletFundingForm slug={slug} modern />
      </div>
      <section className="veloura-panel">
        <div className="veloura-panel-head"><div><h2>Activity</h2><p>Your latest wallet movements.</p></div></div>
        {wallet.transactions.length === 0 ? (
          <div className="veloura-empty"><ReceiptText size={26} /><p style={{ margin: 0 }}>No activity yet. Add money to get started.</p></div>
        ) : (
          <ul className="acx-txn">
            {wallet.transactions.map((tx: any) => {
              const amount = Number(tx.amount);
              const incoming = amount >= 0;
              const label = tx.type === "PAYMENT" ? (tx.orderId ? "Order payment" : "Booking payment") : TXN_LABEL[tx.type] ?? tx.type;
              return (
                <li key={tx.id}>
                  <span className={`acx-txn-ico ${incoming ? "in" : ""}`} aria-hidden="true">{incoming ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
                  <div className="acx-txn-main"><b>{label}</b><span>{formatDate(new Date(tx.createdAt), { day: "2-digit", month: "short", year: "numeric" })} · {tx.reference}</span></div>
                  <div className="acx-txn-amt"><b className={incoming ? "in" : ""}>{incoming ? "+" : "−"}{formatMoney(Math.abs(amount), currency)}</b><span>Balance {formatMoney(Number(tx.balanceAfter), currency)}</span></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
