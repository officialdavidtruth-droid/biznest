"use client";

import { useState } from "react";

/** A ready-to-send note a vendor can paste into WhatsApp, Instagram or an invoice so customers aren't surprised by BizNest on the payment page. */
export function CustomerPaymentMessage({ storeName }: { storeName: string }) {
  const message = `Hello! You'll pay ${storeName} through BizNest, our payment partner. The payment page may show BizNest or our payment partner's name, and the money goes to ${storeName}. Your payment is secure, and you'll get a receipt once it goes through.`;
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
    <div className="mb-6 max-w-xl rounded-lg border bg-background p-4">
      <h2 className="text-sm font-semibold">Tell customers how they&apos;ll pay</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Customers pay through BizNest, so the payment page may not show your business name. Send this note with your payment link or invoice so they know it&apos;s you.
      </p>
      <textarea readOnly value={message} rows={4} className="mt-3 w-full rounded-md border bg-muted/30 p-2 text-sm" onFocus={(e) => e.currentTarget.select()} />
      <button onClick={copy} className="mt-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
        {copied ? "Copied" : "Copy message"}
      </button>
    </div>
  );
}
