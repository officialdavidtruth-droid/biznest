"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { deleteSavedCart } from "@/lib/actions/account";
import { ShoppingBag, Trash2 } from "lucide-react";

type SavedCart = {
  id: string;
  updatedAt: Date;
  items: unknown;
  store: { slug: string; name: string; logoUrl: string | null };
};

export function SavedCartsList({ initialCarts }: { initialCarts: SavedCart[] }) {
  const [carts, setCarts] = useState(initialCarts);

  async function handleDelete(id: string) {
    const result = await deleteSavedCart(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setCarts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Saved cart removed.");
  }

  if (carts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
        <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">No saved carts. Save a cart at checkout to pick it up later.</p>
      </div>
    );
  }

  const itemCount = (items: unknown) => (Array.isArray(items) ? items.length : 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {carts.map((cart) => (
        <div key={cart.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Link href={`/store/${cart.store.slug}`} className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{cart.store.name}</div>
            <div className="text-xs text-slate-500">
              {itemCount(cart.items)} item{itemCount(cart.items) === 1 ? "" : "s"} · saved{" "}
              {new Date(cart.updatedAt).toLocaleDateString()}
            </div>
          </Link>
          <button onClick={() => handleDelete(cart.id)} className="rounded p-1.5 text-slate-400 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
