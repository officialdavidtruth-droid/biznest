"use client";

import { useCart } from "@/lib/cart-context";
import { toast } from "sonner";

export function AddToCartButton({
  storeSlug,
  productId,
  name,
  price,
  currency,
  image,
}: {
  storeSlug: string;
  productId: string;
  name: string;
  price: number;
  currency: string;
  image: string | null;
}) {
  const { addItem } = useCart();

  return (
    <button
      onClick={() => {
        addItem(storeSlug, { productId, name, price, currency, image });
        toast.success(`Added ${name} to cart`);
      }}
      className="mt-2 w-full rounded-md py-1.5 text-xs font-medium transition hover:brightness-110"
      style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
    >
      Add to cart
    </button>
  );
}
