"use client";

import { use } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Minus, Plus, X } from "lucide-react";

export default function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { items, storeSlug, setQuantity, removeItem, subtotal } = useCart();

  const cartItems = storeSlug === slug ? items : [];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Your cart</h1>

      {cartItems.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Your cart is empty.{" "}
          <Link href={`/store/${slug}`} className="text-primary hover:underline">
            Continue shopping →
          </Link>
        </div>
      ) : (
        <>
          <div className="divide-y rounded-lg border">
            {cartItems.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 p-4">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-14 w-14 rounded object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded bg-muted" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.currency} {item.price.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    className="rounded border p-1"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    className="rounded border p-1"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button onClick={() => removeItem(item.productId)} className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-lg font-semibold">
              {cartItems[0]?.currency} {subtotal.toLocaleString()}
            </span>
          </div>

          <Link
            href={`/store/${slug}/checkout`}
            className="mt-4 block w-full rounded-md py-3 text-center text-sm font-medium"
            style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
          >
            Proceed to checkout
          </Link>
        </>
      )}
    </div>
  );
}
