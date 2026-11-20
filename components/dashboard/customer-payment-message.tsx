"use client";

import { useState } from "react";

/** A ready-to-send note a vendor can paste into WhatsApp, Instagram or an invoice so customers aren't surprised by BizNest on the payment page. */
export function CustomerPaymentMessage({ storeName }: { storeName: string }) {
  const message = `Hello! Your payment to ${storeName} is processed securely by BizNest, our payment partner. The payment page may show BizNest or the payment partner's name, but the money goes to ${storeName}. Your payment is secure, and you'll get a receipt once it goes through.`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="max-w-xl rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold">A message to send your customers</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The payment page may show BizNest instead of your business name. Paste this note with your payment link or invoice so customers know it's really you.
      </p>
      <textarea readOnly value={message} rows={5} className="mt-3 w-full rounded-xl border bg-muted/30 p-3 text-sm" onFocus={(e) => e.currentTarget.select()} />
      <button onClick={copy} className="mt-3 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted sm:w-auto">
        {copied ? "Copied" : "Copy message"}
      </button>
    </div>
  );
}
