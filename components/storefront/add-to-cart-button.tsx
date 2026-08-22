"use client";

import { useCart } from "@/lib/cart-context";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import { toast } from "sonner";

export function AddToCartButton({
  storeSlug,
  productId,
  name,
  price,
  currency,
  image,
  accent = "#0041C8",
  onAccent = "#FFFFFF",
}: {
  storeSlug: string;
  productId: string;
  name: string;
  price: number;
  currency: string;
  image: string | null;
  accent?: string;
  onAccent?: string;
}) {
  const { addItem } = useCart();
  const { requireSignedIn } = useShopAuthGate(storeSlug);

  return (
    <button
      onClick={() => {
        if (!requireSignedIn("add items to your cart")) return;
        addItem(storeSlug, { productId, name, price, currency, image });
        toast.success(`Added ${name} to cart`);
      }}
      className="mt-2 w-full rounded-lg py-2 text-xs font-semibold tracking-wide transition-all hover:-translate-y-0.5 hover:brightness-110"
      style={{ background: accent, color: onAccent, boxShadow: `0 4px 14px ${accent}4d` }}
    >
      Add to cart
    </button>
  );
}
