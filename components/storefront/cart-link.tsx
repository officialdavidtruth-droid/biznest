"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";

export function CartLink({ storeSlug }: { storeSlug: string }) {
  const { items, storeSlug: cartStoreSlug } = useCart();
  const count = cartStoreSlug === storeSlug ? items.reduce((n, i) => n + i.quantity, 0) : 0;

  return (
    <Link href={`/store/${storeSlug}/cart`} className="relative flex items-center gap-1 text-sm">
      <ShoppingCart className="h-4 w-4" />
      {count > 0 && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
