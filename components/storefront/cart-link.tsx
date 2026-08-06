"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";

export function CartLink({
  storeSlug,
  accent = "#0041C8",
  onAccent = "#FFFFFF",
  ink = "#141D23",
}: {
  storeSlug: string;
  accent?: string;
  onAccent?: string;
  ink?: string;
}) {
  const { items, storeSlug: cartStoreSlug } = useCart();
  const count = cartStoreSlug === storeSlug ? items.reduce((n, i) => n + i.quantity, 0) : 0;

  return (
    <Link href={`/store/${storeSlug}/cart`} className="relative flex items-center" aria-label="Cart">
      <ShoppingBag className="h-5 w-5 transition-colors" style={{ color: ink, opacity: 0.85 }} />
      {count > 0 && (
        <span
          className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ background: accent, color: onAccent }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
