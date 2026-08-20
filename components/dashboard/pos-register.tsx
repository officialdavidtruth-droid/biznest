"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Barcode, Minus, Plus, Trash2, X, ShoppingBag } from "lucide-react";
import { createPosSale, lookupPosBarcode, type PosCatalogItem } from "@/lib/actions/pos";
import { posTenderTypes } from "@/lib/validations/pos";
import { roundMoney } from "@/lib/utils/pricing";

type CartLine = {
  key: string; // productId, variantId, or serviceId — unique per cart
  productId?: string;
  variantId?: string;
  serviceId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  maxQuantity: number | null;
};

export function PosRegister({
  slug,
  catalog,
  commissionRatePercent,
}: {
  slug: string;
  catalog: PosCatalogItem[];
  commissionRatePercent: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [pickingVariantsFor, setPickingVariantsFor] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tenderType, setTenderType] = useState<(typeof posTenderTypes)[number]>("Cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [charging, setCharging] = useState(false);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);

  const currency = catalog[0]?.currency ?? "NGN";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.barcode?.toLowerCase().includes(q)
    );
  }, [catalog, query]);

  function addLine(line: CartLine) {
    setCart((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) {
        const nextQty = existing.quantity + line.quantity;
        if (existing.maxQuantity !== null && nextQty > existing.maxQuantity) {
          toast.error(`Only ${existing.maxQuantity} in stock.`);
          return prev;
        }
        return prev.map((l) => (l.key === line.key ? { ...l, quantity: nextQty } : l));
      }
      if (line.maxQuantity !== null && line.maxQuantity < 1) {
        toast.error("Out of stock.");
        return prev;
      }
      return [...prev, line];
    });
  }

  function addProduct(item: PosCatalogItem) {
    if (item.hasVariants) {
      setPickingVariantsFor(item.id);
      return;
    }
    addLine({
      key: item.kind === "service" ? `service:${item.id}` : `product:${item.id}`,
      productId: item.kind === "product" ? item.id : undefined,
      serviceId: item.kind === "service" ? item.id : undefined,
      name: item.name,
      unitPrice: item.price,
      quantity: 1,
      maxQuantity: item.quantity,
    });
  }

  function addVariant(item: PosCatalogItem, variantId: string) {
    const variant = item.variants.find((v) => v.id === variantId);
    if (!variant) return;
    addLine({
      key: `variant:${variant.id}`,
      variantId: variant.id,
      productId: item.id,
      name: `${item.name} — ${variant.label}`,
      unitPrice: variant.price,
      quantity: 1,
      maxQuantity: variant.quantity,
    });
    setPickingVariantsFor(null);
  }

  function updateQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l;
          const nextQty = l.quantity + delta;
          if (l.maxQuantity !== null && nextQty > l.maxQuantity) {
            toast.error(`Only ${l.maxQuantity} in stock.`);
            return l;
          }
          return { ...l, quantity: nextQty };
        })
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    setLookingUpBarcode(true);
    const result = await lookupPosBarcode(slug, barcode.trim());
    setLookingUpBarcode(false);
    setBarcode("");
    if (!result.success) return toast.error(result.error);
    addLine({
      key: result.variantId ? `variant:${result.variantId}` : `product:${result.productId}`,
      productId: result.productId,
      variantId: result.variantId ?? undefined,
      name: result.name,
      unitPrice: result.price,
      quantity: 1,
      maxQuantity: null, // barcode lookup doesn't return stock; the charge step still enforces it
    });
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const estimatedCommission = roundMoney(subtotal * (commissionRatePercent / 100));
  const netToKeep = roundMoney(subtotal - estimatedCommission);

  async function handleCharge() {
    if (cart.length === 0) return;
    setCharging(true);
    const result = await createPosSale(slug, {
      items: cart.map((l) => ({
        productId: l.variantId ? undefined : l.productId,
        variantId: l.variantId,
        serviceId: l.serviceId,
        quantity: l.quantity,
      })),
      tenderType,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
    });
    setCharging(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`Sale complete — ${currency} ${result.data.total.toLocaleString()}`);
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    router.refresh();
  }

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_360px]">
      {/* Catalog */}
      <div className="flex flex-col overflow-hidden">
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or services…"
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <form onSubmit={handleBarcodeSubmit} className="relative w-40 shrink-0">
            <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan barcode"
              disabled={lookingUpBarcode}
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </form>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pb-4 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const outOfStock = !item.hasVariants && item.quantity !== null && item.quantity <= 0;
            return (
              <div key={`${item.kind}:${item.id}`} className="relative">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addProduct(item)}
                  className="flex w-full flex-col items-start gap-1 rounded-lg border bg-background p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="mb-1 h-20 w-full rounded-md object-cover" />
                  ) : (
                    <div className="mb-1 flex h-20 w-full items-center justify-center rounded-md bg-muted">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <p className="line-clamp-2 font-medium leading-snug">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.currency} {item.price.toLocaleString()}
                    {item.hasVariants ? " · variants" : ""}
                  </p>
                  {outOfStock && <span className="text-xs font-medium text-destructive">Out of stock</span>}
                </button>

                {pickingVariantsFor === item.id && (
                  <div className="absolute inset-x-0 top-full z-10 mt-1 rounded-lg border bg-background p-2 shadow-lg">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="px-1 text-xs font-medium text-muted-foreground">Choose an option</p>
                      <button onClick={() => setPickingVariantsFor(null)} className="p-1 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="max-h-48 space-y-0.5 overflow-y-auto">
                      {item.variants.map((v) => (
                        <button
                          key={v.id}
                          disabled={v.quantity <= 0}
                          onClick={() => addVariant(item, v.id)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span>{v.label}</span>
                          <span className="text-muted-foreground">
                            {item.currency} {v.price.toLocaleString()} · {v.quantity} left
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No matching items.</p>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="flex flex-col overflow-hidden rounded-lg border bg-background">
        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty — tap an item to add it.</p>
          ) : (
            <div className="space-y-2">
              {cart.map((line) => (
                <div key={line.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {currency} {line.unitPrice.toLocaleString()} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(line.key, -1)} className="rounded p-1 hover:bg-muted">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-xs">{line.quantity}</span>
                    <button onClick={() => updateQuantity(line.key, 1)} className="rounded p-1 hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button onClick={() => removeLine(line.key)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex gap-1.5">
            {posTenderTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTenderType(t)}
                className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors ${
                  tenderType === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-1 border-t pt-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Collect from customer</span>
              <span className="font-semibold">
                {currency} {subtotal.toLocaleString()}
              </span>
            </div>
            {estimatedCommission > 0 && (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Platform commission ({commissionRatePercent}%)</span>
                  <span>-{currency} {estimatedCommission.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Yours to keep</span>
                  <span>{currency} {netToKeep.toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-muted-foreground/80">
                  Cash is collected in full — commission is tracked and settled separately (see Payments).
                </p>
              </>
            )}
          </div>

          <button
            onClick={handleCharge}
            disabled={cart.length === 0 || charging}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {charging ? "Charging…" : `Charge ${currency} ${subtotal.toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
