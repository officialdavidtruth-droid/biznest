"use client";

import { useEffect } from "react";

/** Puts demo items in the cart for the preview store, then reloads once so the cart provider picks them up. */
export function SeedDemoCart({ items }: { items: unknown[] }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem("biznest_cart");
      const cur = raw ? JSON.parse(raw) : null;
      if (cur?.storeSlug !== "preview" || !cur?.items?.length) {
        localStorage.setItem("biznest_cart", JSON.stringify({ storeSlug: "preview", items }));
        location.reload();
      }
    } catch { /* storage blocked: the preview just shows an empty cart */ }
  }, [items]);
  return null;
}
