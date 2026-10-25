import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { listMyGiftCards } from "@/lib/actions/gift-card";
import { GiftCardBalanceForm } from "@/components/account/gift-card-balance-form";
import { formatMoney } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, cards] = await Promise.all([getStoreBranding(slug), listMyGiftCards(slug)]);
  if (!store) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Gift cards</h1>
        <p className="text-sm text-muted-foreground">Gift cards for {store.name}. Show the code at the shop to spend it.</p>
      </div>

      <section className="space-y-3">
        {cards.map((c) => (
          <div key={c.id} className="rounded-lg border p-4">
            <p className="font-mono text-lg font-semibold">{c.code}</p>
            <p className="text-sm">Balance: <strong>{formatMoney(Number(c.balance))}</strong></p>
            {c.expiresAt && <p className="text-xs text-muted-foreground">Expires {formatDate(c.expiresAt)}</p>}
            {c.message && <p className="mt-2 text-sm italic">“{c.message}”</p>}
          </div>
        ))}
        {cards.length === 0 && (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No gift cards on your account. Cards sent to your verified email address appear here.
          </p>
        )}
      </section>

      <GiftCardBalanceForm slug={slug} />
    </div>
  );
}
