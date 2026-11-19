"use client";

import { useEffect, useState } from "react";
import { Printer, CheckCircle2, Clock, Ban } from "lucide-react";
import { biznestPromoUrl } from "@/lib/branding";
import type { ReceiptData } from "@/lib/receipts/load";

type Paper = "thermal" | "a4";

const TONE: Record<ReceiptData["status"]["tone"], { pill: string; hero: string; Icon: typeof CheckCircle2 }> = {
  paid: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", hero: "bg-emerald-50 text-emerald-900", Icon: CheckCircle2 },
  pending: { pill: "bg-amber-50 text-amber-800 ring-amber-200", hero: "bg-amber-50 text-amber-900", Icon: Clock },
  void: { pill: "bg-gray-100 text-gray-700 ring-gray-300", hero: "bg-gray-100 text-gray-800", Icon: Ban },
};

export function ReceiptSheet({ receipt, backHref, autoPrint = false }: { receipt: ReceiptData; backHref: string; autoPrint?: boolean }) {
  const [paper, setPaper] = useState<Paper>("a4");
  // Opened from the POS "Print receipt" button: go straight to the print dialog.
  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [autoPrint]);
  const thermal = paper === "thermal";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 pb-10 print:bg-white print:pb-0">
      {/* The @page rule has to change with the paper choice, so it lives here rather than in a stylesheet. */}
      <style>{`@media print { @page { size: ${thermal ? "80mm auto" : "A4"}; margin: ${thermal ? "4mm" : "14mm"}; } html, body { background: #fff !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 print:hidden">
        <a href={backHref} className="text-sm font-medium text-gray-600 hover:underline">
          ← Back
        </a>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white text-xs font-medium">
            <button type="button" onClick={() => setPaper("a4")} className={`px-3 py-2 ${!thermal ? "bg-gray-900 text-white" : "text-gray-700"}`}>
              A4
            </button>
            <button type="button" onClick={() => setPaper("thermal")} className={`px-3 py-2 ${thermal ? "bg-gray-900 text-white" : "text-gray-700"}`}>
              80mm roll
            </button>
          </div>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {(() => {
        const tone = TONE[receipt.status.tone];
        const Icon = tone.Icon;
        const grand = receipt.totals.find((r) => r.strong) ?? receipt.totals[receipt.totals.length - 1];
        const rest = receipt.totals.filter((r) => r !== grand);
        const hasCustomer = receipt.customer.name || receipt.customer.email || receipt.customer.phone || receipt.customer.address;
        const contact = [receipt.store.phone, receipt.store.email].filter(Boolean);
        return (
          <div
            className={`relative mx-auto overflow-hidden bg-white text-gray-900 shadow-xl shadow-gray-400/20 ring-1 ring-black/5 print:shadow-none print:ring-0 ${
              thermal ? "w-[80mm] max-w-full text-[11px]" : "max-w-xl rounded-2xl text-sm print:max-w-none print:rounded-none"
            }`}
          >
            <div className="h-1.5 bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700 print:hidden" />

            <div className={thermal ? "px-3 pb-4 pt-3" : "px-8 pb-8 pt-8 print:px-0"}>
              {/* Store identity */}
              <header className="flex flex-col items-center text-center">
                {receipt.store.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={receipt.store.logoUrl}
                    alt=""
                    className={`${thermal ? "h-10 w-10" : "h-16 w-16"} rounded-xl object-cover ring-1 ring-black/10`}
                  />
                )}
                <p className={`mt-3 font-semibold tracking-tight ${thermal ? "text-sm" : "text-xl"}`}>{receipt.store.name}</p>
                {contact.length > 0 && <p className="mt-0.5 text-gray-500">{contact.join("  •  ")}</p>}
              </header>

              {/* Amount hero */}
              <div className={`mt-6 rounded-xl text-center ${tone.hero} ${thermal ? "px-2 py-3" : "px-4 py-5"}`}>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${tone.pill}`}>
                  <Icon className="h-3.5 w-3.5" /> {receipt.status.label}
                </span>
                {grand && (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wider opacity-70">{grand.label}</p>
                    <p className={`font-bold tabular-nums tracking-tight ${thermal ? "text-2xl" : "text-4xl"}`}>{grand.value}</p>
                  </>
                )}
              </div>

              {/* Meta */}
              <dl className={`mt-6 grid gap-x-6 gap-y-4 ${thermal || !hasCustomer ? "grid-cols-1 text-center" : "grid-cols-2"}`}>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{receipt.heading}</dt>
                  <dd className="mt-0.5 font-mono font-medium">{receipt.number}</dd>
                  <dd className="text-gray-500">{receipt.issuedAt}</dd>
                </div>
                {hasCustomer && (
                  <div className={thermal ? "" : "text-right"}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Billed to</dt>
                    {receipt.customer.name && <dd className="mt-0.5 font-medium">{receipt.customer.name}</dd>}
                    {receipt.customer.phone && <dd className="text-gray-500">{receipt.customer.phone}</dd>}
                    {receipt.customer.email && <dd className="break-all text-gray-500">{receipt.customer.email}</dd>}
                    {receipt.customer.address && <dd className="text-gray-500">{receipt.customer.address}</dd>}
                  </div>
                )}
              </dl>

              {/* Items */}
              <div className="mt-6">
                <div className="flex justify-between border-b border-gray-200 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <span>Items</span>
                  <span>Amount</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {receipt.lines.map((line, i) => (
                    <li key={i} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">{line.description}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {line.qty} × {line.unit}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums">{line.amount}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Totals */}
              {rest.length > 0 && (
                <dl className="space-y-1.5 border-t border-gray-200 pt-3">
                  {rest.map((row) => (
                    <div key={row.label} className="flex justify-between gap-4">
                      <dt className="text-gray-500">{row.label}</dt>
                      <dd className="tabular-nums">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* Payment details */}
              {receipt.details.length > 0 && (
                <dl className="mt-5 space-y-1.5 rounded-xl bg-gray-50 px-4 py-3 print:bg-gray-50">
                  {receipt.details.map((row) => (
                    <div key={row.label} className="flex justify-between gap-4">
                      <dt className="text-gray-500">{row.label}</dt>
                      <dd className="break-all text-right font-medium">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {receipt.note && <p className="mt-4 text-center text-gray-500">{receipt.note}</p>}

              <div className="mt-7 border-t border-dashed border-gray-300 pt-5 text-center">
                <p className="font-medium text-gray-700">Thank you for your business</p>
                {receipt.store.poweredBy && (
                  <p className="mt-2 text-xs text-gray-400 print:text-gray-500">
                    Powered by BizNest ·{" "}
                    <a href={biznestPromoUrl(receipt.store.slug, "receipt")} target="_blank" rel="noopener" className="font-medium text-gray-500 underline">
                      Open your free store
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
