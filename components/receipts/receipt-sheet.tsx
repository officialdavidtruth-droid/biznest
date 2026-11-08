"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { biznestPromoUrl } from "@/lib/branding";
import type { ReceiptData } from "@/lib/receipts/load";
import { TableScroll } from "@/components/ui/table-scroll";

type Paper = "thermal" | "a4";

const TONE: Record<ReceiptData["status"]["tone"], string> = {
  paid: "border-emerald-600 text-emerald-700",
  pending: "border-amber-600 text-amber-700",
  void: "border-gray-500 text-gray-600",
};

export function ReceiptSheet({ receipt, backHref }: { receipt: ReceiptData; backHref: string }) {
  const [paper, setPaper] = useState<Paper>("a4");
  const thermal = paper === "thermal";

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* The @page rule has to change with the paper choice, so it lives here rather than in a stylesheet. */}
      <style>{`@media print { @page { size: ${thermal ? "80mm auto" : "A4"}; margin: ${thermal ? "4mm" : "14mm"}; } html, body { background: #fff !important; } }`}</style>

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

      <div
        className={`mx-auto bg-white text-gray-900 shadow-sm print:shadow-none ${thermal ? "w-[80mm] max-w-full p-3 text-[11px]" : "max-w-3xl p-8 text-sm print:max-w-none print:p-0"}`}
      >
        <header className={`flex ${thermal ? "flex-col items-center text-center" : "items-start justify-between"} gap-3`}>
          <div className={`flex ${thermal ? "flex-col items-center" : "items-center"} gap-3`}>
            {receipt.store.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receipt.store.logoUrl} alt="" className={thermal ? "h-10 w-10 object-contain" : "h-14 w-14 object-contain"} />
            )}
            <div>
              <p className={`font-bold ${thermal ? "text-sm" : "text-lg"}`}>{receipt.store.name}</p>
              {receipt.store.phone && <p className="text-gray-600">{receipt.store.phone}</p>}
              {receipt.store.email && <p className="text-gray-600">{receipt.store.email}</p>}
            </div>
          </div>
          <div className={thermal ? "" : "text-right"}>
            <p className={`font-bold uppercase tracking-wide ${thermal ? "text-xs" : "text-base"}`}>{receipt.heading}</p>
            <p className="font-mono text-gray-700">{receipt.number}</p>
            <p className="text-gray-600">{receipt.issuedAt}</p>
          </div>
        </header>

        <div className={`my-4 flex ${thermal ? "justify-center" : "justify-between"} items-start gap-3 border-y border-dashed border-gray-400 py-3`}>
          {(receipt.customer.name || receipt.customer.email || receipt.customer.phone || receipt.customer.address) && (
            <div className={thermal ? "text-center" : ""}>
              <p className="text-[10px] font-semibold uppercase text-gray-500">Customer</p>
              {receipt.customer.name && <p className="font-medium">{receipt.customer.name}</p>}
              {receipt.customer.phone && <p className="text-gray-600">{receipt.customer.phone}</p>}
              {receipt.customer.email && <p className="text-gray-600">{receipt.customer.email}</p>}
              {receipt.customer.address && <p className="text-gray-600">{receipt.customer.address}</p>}
            </div>
          )}
          <span className={`rounded border-2 px-2 py-1 text-xs font-bold uppercase ${TONE[receipt.status.tone]}`}>{receipt.status.label}</span>
        </div>

        <TableScroll><table className="w-full">
          <thead>
            <tr className="border-b border-gray-400 text-left text-[10px] uppercase text-gray-500">
              <th className="py-1 font-semibold">Item</th>
              <th className="py-1 text-center font-semibold">Qty</th>
              {!thermal && <th className="py-1 text-right font-semibold">Price</th>}
              <th className="py-1 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line, i) => (
              <tr key={i} className="border-b border-gray-200 align-top">
                <td className="py-1.5 pr-2">{line.description}</td>
                <td className="py-1.5 text-center">{line.qty}</td>
                {!thermal && <td className="py-1.5 text-right">{line.unit}</td>}
                <td className="py-1.5 text-right">{line.amount}</td>
              </tr>
            ))}
          </tbody>
        </table></TableScroll>

        <dl className={`mt-3 space-y-1 ${thermal ? "" : "ml-auto max-w-xs"}`}>
          {receipt.totals.map((row) => (
            <div key={row.label} className={`flex justify-between gap-4 ${row.strong ? "border-t border-gray-400 pt-1 text-base font-bold" : ""}`}>
              <dt className={row.strong ? "" : "text-gray-600"}>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        {receipt.details.length > 0 && (
          <dl className="mt-4 space-y-0.5 border-t border-dashed border-gray-400 pt-3 text-gray-700">
            {receipt.details.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-gray-500">{row.label}</dt>
                <dd className="break-all text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {receipt.note && <p className="mt-3 text-gray-600">{receipt.note}</p>}

        <p className="mt-6 text-center text-gray-500">Thank you for your business.</p>
        {receipt.store.poweredBy && (
          <p className="mt-3 text-center text-xs text-gray-400 print:text-gray-500">
            Powered by BizNest ·{" "}
            <a href={biznestPromoUrl(receipt.store.slug, "receipt")} target="_blank" rel="noopener" className="font-medium text-gray-500 underline">Open your free store</a>
          </p>
        )}
      </div>
    </div>
  );
}
