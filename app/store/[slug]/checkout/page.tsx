"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { startCheckout } from "@/lib/actions/order";
import { toast } from "sonner";

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { items, storeSlug, subtotal } = useCart();
  const cartItems = storeSlug === slug ? items : [];
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    fullName: "", phone: "", address: "", city: "", state: "", country: "Nigeria",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setIsSubmitting(true);
    const result = await startCheckout(slug, {
      items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      shippingAddress: form,
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    window.location.href = result.data.authorizationUrl;
  }

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-muted-foreground">
        Your cart is empty.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Checkout</h1>

      <div className="mb-6 rounded-lg border p-4 text-sm">
        {cartItems.map((i) => (
          <div key={i.productId} className="flex justify-between py-1">
            <span>{i.name} × {i.quantity}</span>
            <span>{i.currency} {(i.price * i.quantity).toLocaleString()}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-2 font-medium">
          <span>Total</span>
          <span>{cartItems[0].currency} {subtotal.toLocaleString()}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input required placeholder="Full name" className="input" value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input required placeholder="Phone" className="input" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input required placeholder="Delivery address" className="input" value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="City" className="input" value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input required placeholder="State" className="input" value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
        <input required placeholder="Country" className="input" value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md py-3 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--bn-marigold)", color: "var(--bn-ink)" }}
        >
          {isSubmitting ? "Redirecting to payment…" : "Pay now"}
        </button>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
