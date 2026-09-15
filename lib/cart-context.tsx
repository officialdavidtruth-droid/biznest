"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type CartItem = {
  productId: string;
  variantId?: string | null;
  variantLabel?: string | null;
  optionValues?: Record<string, string> | null;
  name: string;
  price: number;
  currency: string;
  image: string | null;
  quantity: number;
};

type CartState = {
  storeSlug: string | null;
  items: CartItem[];
};

type CartContextValue = {
  storeSlug: string | null;
  items: CartItem[];
  addItem: (storeSlug: string, item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  setQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  clear: () => void;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "biznest_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ storeSlug: null, items: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // corrupted or blocked storage — start fresh rather than crash
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const addItem = useCallback(
    (storeSlug: string, item: Omit<CartItem, "quantity">, quantity = 1) => {
      setState((prev) => {
        // Adding from a different store starts a fresh cart — checkout is
        // per-seller, so mixing stores in one cart doesn't make sense yet.
        const base = prev.storeSlug && prev.storeSlug !== storeSlug ? { storeSlug, items: [] } : prev;
        const existing = base.items.find((i) => i.productId === item.productId && (i.variantId ?? null) === (item.variantId ?? null));
        const items = existing
          ? base.items.map((i) =>
              i.productId === item.productId && (i.variantId ?? null) === (item.variantId ?? null)
                ? { ...i, quantity: i.quantity + quantity }
                : i
            )
          : [...base.items, { ...item, quantity }];
        return { storeSlug, items };
      });
    },
    []
  );

  const removeItem = useCallback((productId: string, variantId?: string | null) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((i) => !(i.productId === productId && (i.variantId ?? null) === (variantId ?? null))),
    }));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number, variantId?: string | null) => {
    setState((prev) => ({
      ...prev,
      items:
        quantity <= 0
          ? prev.items.filter((i) => !(i.productId === productId && (i.variantId ?? null) === (variantId ?? null)))
          : prev.items.map((i) =>
              i.productId === productId && (i.variantId ?? null) === (variantId ?? null)
                ? { ...i, quantity: Math.min(999, Math.max(1, Math.floor(quantity))) }
                : i
            ),
    }));
  }, []);

  const clear = useCallback(() => setState({ storeSlug: null, items: [] }), []);

  const subtotal = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ storeSlug: state.storeSlug, items: state.items, addItem, removeItem, setQuantity, clear, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
