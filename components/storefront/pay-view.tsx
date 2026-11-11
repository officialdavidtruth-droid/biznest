import Link from "next/link";
import { DEFAULT_PAGE_SKIN, surfaceStyle } from "@/lib/storefront/page-skin";
import type { StorePalette } from "@/lib/store-palette-defaults";
import { ManualPaymentPanel } from "@/components/storefront/manual-payment-panel";

type Info = { bankName?: string | null; accountName?: string | null; accountNumber?: string | null; note?: string | null; whatsapp?: string | null; call?: string | null };

/** The customer's bank-transfer payment page. Shared by the real route and the template preview. */
export function PayView({ palette, slug, store, label, code, status, reference, totalLabel, info, ready, initialProofUrl }: {
  palette: StorePalette; slug: string; store: { name: string }; label: string; code: string; status: string; reference: string; totalLabel: string; info: Info; ready: boolean; initialProofUrl: string | null;
}) {
  const skin = palette.skin ?? DEFAULT_PAGE_SKIN;
  const card = surfaceStyle(skin, palette.ink, palette.card, palette.surface, palette.accent);
  const wide = skin.layout === "wide-form" || skin.layout === "summary-left" || skin.layout === "split-bleed";
  const narrow = skin.layout === "narrow-centre" || skin.layout === "single";
  const centred = skin.layout === "summary-top" || skin.layout === "narrow-centre";
  const padY = skin.density === "compact" ? "py-8" : skin.density === "airy" ? "py-20" : "py-14";

  return (
    <div style={{ background: palette.surface, color: palette.ink, minHeight: "100vh", fontFamily: palette.font }} className="storefront-root">
      <main style={{ maxWidth: wide ? 860 : narrow ? 560 : 720 }} className={`mx-auto px-6 ${padY} ${centred ? "text-center" : ""}`}>
        <h1 style={{ fontFamily: palette.headlineFont }} className="text-3xl font-extrabold">Complete your payment</h1>
        <p className="mt-2 mb-8 text-sm" style={{ opacity: 0.7 }}>
          {label} #{code} · {store.name}
        </p>

        {status === "SUCCESSFUL" ? (
          <div className="p-6 text-sm" style={card}>
            <p className="font-semibold">Payment confirmed. Thank you!</p>
            <p className="mt-1" style={{ opacity: 0.75 }}>{store.name} has received your payment.</p>
            <Link href={`/store/${slug}`} className="mt-4 inline-block font-semibold no-underline" style={{ color: palette.accent }}>Back to store</Link>
          </div>
        ) : status !== "PENDING" ? (
          <p className="p-6 text-sm" style={card}>This payment is no longer open. Please contact {store.name}.</p>
        ) : ready ? (
          <ManualPaymentPanel
            slug={slug}
            reference={reference}
            subject={`${label.toLowerCase()} #${code}`}
            orderCode={code}
            storeName={store.name}
            totalLabel={totalLabel}
            info={{
              bankName: info.bankName!,
              accountName: info.accountName!,
              accountNumber: info.accountNumber!,
              note: info.note ?? null,
              whatsapp: info.whatsapp ?? null,
              call: info.call ?? null,
            }}
            initialProofUrl={initialProofUrl}
            palette={palette}
          />
        ) : (
          <p className="p-6 text-sm" style={card}>
            {store.name} hasn&apos;t published its payment details right now. Please contact the store to complete this payment.
          </p>
        )}
      </main>
    </div>
  );
}
