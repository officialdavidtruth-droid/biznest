// Route: /receipts/[slug]/[kind]/[id]  (kind = order | payment | bill | folio)
// Vendor-only, print-optimised receipt. Lives outside /store/[slug]/admin on purpose so the
// dashboard sidebar and header never end up on the printed page.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadReceipt, isReceiptKind } from "@/lib/receipts/load";
import { ReceiptSheet } from "@/components/receipts/receipt-sheet";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ slug: string; kind: string; id: string }> }) {
  const { slug, kind, id } = await params;
  if (!isReceiptKind(kind)) return notFound();

  const result = await loadReceipt(slug, kind, id);
  if (!result.ok) {
    if (result.status === 401) redirect(`/login?callbackUrl=${encodeURIComponent(`/receipts/${slug}/${kind}/${id}`)}`);
    if (result.status === 404) notFound();
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-gray-600">
        {result.error}
      </div>
    );
  }

  return <ReceiptSheet receipt={result.receipt} backHref={`/${slug}/admin/receipts`} />;
}
