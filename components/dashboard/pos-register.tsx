"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search, Barcode, Minus, Plus, Trash2, X, ShoppingBag,
  SlidersHorizontal, Tag, CreditCard, Landmark, Banknote, ScanLine,
} from "lucide-react";
import { createPosSale, lookupPosBarcode, searchPosCustomers, type PosCatalogItem, type PosCustomerMatch } from "@/lib/actions/pos";
import { posTenderTypes } from "@/lib/validations/pos";
import { roundMoney } from "@/lib/utils/pricing";

type CartLine = {
  key: string;
  productId?: string;
  variantId?: string;
  serviceId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  maxQuantity: number | null;
  image?: string | null;
};

const categoryFor = (item: PosCatalogItem) => {
  const name = item.name.toLowerCase();
  if (item.kind === "service") return "Services";
  if (/drink|water|juice|coke|coffee|tea|chapman|smoothie/.test(name)) return "Drinks";
  if (/cake|ice cream|dessert|pudding|pie|sweet/.test(name)) return "Desserts";
  if (/snack|roll|suya|meat pie|spring/.test(name)) return "Snacks";
  return "Food";
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
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [pickingVariantsFor, setPickingVariantsFor] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tenderType, setTenderType] = useState<(typeof posTenderTypes)[number]>("Cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerProfileId, setCustomerProfileId] = useState<string | undefined>();
  const [customerMatches, setCustomerMatches] = useState<PosCustomerMatch[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [charging, setCharging] = useState(false);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const chargeIdempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const currency = catalog[0]?.currency ?? "NGN";
  const categories = useMemo(() => ["All Items", ...Array.from(new Set(catalog.map(categoryFor)))], [catalog]);

  useEffect(() => {
    const q = customerPhone.trim() || customerEmail.trim() || customerName.trim();
    if (q.length < 2 || customerProfileId) {
      setCustomerMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchingCustomers(true);
      const matches = await searchPosCustomers(slug, q);
      if (!cancelled) {
        setCustomerMatches(matches);
        setSearchingCustomers(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [slug, customerName, customerPhone, customerEmail, customerProfileId]);

  function chooseCustomer(customer: PosCustomerMatch) {
    setCustomerProfileId(customer.id.startsWith("user:") ? undefined : customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone ?? "");
    setCustomerEmail(customer.email ?? "");
    setCustomerMatches([]);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((item) => {
      const matchesCategory = activeCategory === "All Items" || categoryFor(item) === activeCategory;
      const matchesQuery = !q || item.name.toLowerCase().includes(q) || item.sku?.toLowerCase().includes(q) || item.barcode?.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [catalog, query, activeCategory]);

  function addLine(line: CartLine) {
    setCart((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) {
        const nextQty = existing.quantity + line.quantity;
        if (existing.maxQuantity !== null && nextQty > existing.maxQuantity) {
          toast.error(`Only ${existing.maxQuantity} in stock.`);
          return prev;
        }
        return prev.map((l) => l.key === line.key ? { ...l, quantity: nextQty } : l);
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
      image: item.image,
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
      image: item.image,
    });
    setPickingVariantsFor(null);
  }

  function updateQuantity(key: string, delta: number) {
    setCart((prev) => prev.map((l) => {
      if (l.key !== key) return l;
      const nextQty = l.quantity + delta;
      if (l.maxQuantity !== null && nextQty > l.maxQuantity) {
        toast.error(`Only ${l.maxQuantity} in stock.`);
        return l;
      }
      return { ...l, quantity: nextQty };
    }).filter((l) => l.quantity > 0));
  }

  useEffect(() => { barcodeInputRef.current?.focus(); }, []);

  function refocusBarcodeUnlessTyping(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const isTextField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (!isTextField) setTimeout(() => barcodeInputRef.current?.focus(), 0);
  }

  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    setLookingUpBarcode(true);
    const result = await lookupPosBarcode(slug, barcode.trim());
    setLookingUpBarcode(false);
    setBarcode("");
    barcodeInputRef.current?.focus();
    if (!result.success) return toast.error(result.error);
    addLine({
      key: result.variantId ? `variant:${result.variantId}` : `product:${result.productId}`,
      productId: result.productId,
      variantId: result.variantId ?? undefined,
      name: result.name,
      unitPrice: result.price,
      quantity: 1,
      maxQuantity: null,
    });
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const estimatedCommission = roundMoney(subtotal * (commissionRatePercent / 100));
  const netToKeep = roundMoney(subtotal - estimatedCommission);

  async function handleCharge() {
    if (cart.length === 0) return;
    setCharging(true);
    const result = await createPosSale(slug, {
      items: cart.map((l) => ({ productId: l.variantId ? undefined : l.productId, variantId: l.variantId, serviceId: l.serviceId, quantity: l.quantity })),
      tenderType,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerProfileId,
      idempotencyKey: chargeIdempotencyKeyRef.current,
    });
    setCharging(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`Sale complete — ${currency} ${result.data.total.toLocaleString()}`);
    setCart([]);
    setCustomerName(""); setCustomerPhone(""); setCustomerEmail(""); setCustomerProfileId(undefined); setCustomerMatches([]); setShowCustomer(false);
    chargeIdempotencyKeyRef.current = crypto.randomUUID();
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" onClickCapture={refocusBarcodeUnlessTyping}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <section className="min-w-0 flex-1 overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="border-b px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">Table View</button>
              <button type="button" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm">Walk-in Sale</button>
              <select className="rounded-lg border px-3 py-2 text-sm font-medium" defaultValue="Dine In">
                <option>Dine In</option><option>Takeaway</option><option>Delivery</option>
              </select>
              <div className="relative ml-auto flex min-w-[220px] flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search menu items…" className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <form onSubmit={handleBarcodeSubmit} className="relative hidden w-44 xl:block">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input ref={barcodeInputRef} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan barcode" disabled={lookingUpBarcode} className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </form>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto border-b px-4 py-2">
            {categories.map((category) => (
              <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${activeCategory === category ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                {category}
              </button>
            ))}
            <button type="button" className="ml-auto shrink-0 rounded-lg border p-2 text-muted-foreground hover:bg-muted" aria-label="Filter menu"><SlidersHorizontal className="h-4 w-4" /></button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => {
              const outOfStock = !item.hasVariants && item.quantity !== null && item.quantity <= 0;
              return (
                <div key={`${item.kind}:${item.id}`} className="relative">
                  <button type="button" disabled={outOfStock} onClick={() => addProduct(item)} className="group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50">
                    {item.image ? <img src={item.image} alt="" className="h-28 w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="flex h-28 w-full items-center justify-center bg-muted"><ShoppingBag className="h-8 w-8 text-muted-foreground/40" /></div>}
                    <div className="flex flex-1 items-start gap-2 p-3">
                      <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold leading-snug">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.currency} {item.price.toLocaleString()}</p>{outOfStock && <p className="mt-1 text-xs font-medium text-destructive">Out of stock</p>}</div>
                      <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary"><Plus className="h-4 w-4" /></span>
                    </div>
                  </button>
                  {pickingVariantsFor === item.id && <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border bg-background p-2 shadow-xl"><div className="flex items-center justify-between px-1 pb-1"><p className="text-xs font-medium text-muted-foreground">Choose an option</p><button type="button" onClick={() => setPickingVariantsFor(null)}><X className="h-4 w-4 text-muted-foreground" /></button></div>{item.variants.map((v) => <button type="button" key={v.id} disabled={v.quantity <= 0} onClick={() => addVariant(item, v.id)} className="flex w-full justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-muted disabled:opacity-40"><span>{v.label}</span><span>{item.currency} {v.price.toLocaleString()}</span></button>)}</div>}
                </div>
              );
            })}
            {filtered.length === 0 && <div className="col-span-full flex min-h-48 items-center justify-center text-sm text-muted-foreground">No matching menu items.</div>}
          </div>
        </section>

        <aside className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border bg-background shadow-sm lg:w-[390px] xl:w-[410px]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div><h2 className="text-lg font-semibold">Current Sale</h2><p className="text-xs text-muted-foreground">{cart.length} {cart.length === 1 ? "item" : "items"}</p></div>
            <button type="button" onClick={() => setCart([])} disabled={!cart.length} className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40">Clear All</button>
          </div>
          <div className="grid grid-cols-2 border-b text-sm font-medium"><button type="button" onClick={() => setShowCustomer(false)} className={`border-b-2 px-4 py-3 ${!showCustomer ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Cart ({cart.length})</button><button type="button" onClick={() => setShowCustomer(true)} className={`border-b-2 px-4 py-3 ${showCustomer ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Customer</button></div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!showCustomer ? (
              cart.length === 0 ? <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">Cart is empty — tap an item to add it.</div> :
              <div className="space-y-1">{cart.map((line) => <div key={line.key} className="flex items-center gap-2 border-b py-3 last:border-0"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">{line.image ? <img src={line.image} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="m-auto mt-3 h-5 w-5 text-muted-foreground/50" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{line.name}</p><p className="text-xs text-muted-foreground">{currency} {line.unitPrice.toLocaleString()}</p></div><div className="flex items-center rounded-lg border"><button type="button" onClick={() => updateQuantity(line.key, -1)} className="p-2 hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button><span className="w-7 text-center text-xs font-medium">{line.quantity}</span><button type="button" onClick={() => updateQuantity(line.key, 1)} className="p-2 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button></div><div className="w-20 text-right text-sm font-medium">{currency} {(line.unitPrice * line.quantity).toLocaleString()}</div><button type="button" onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))} className="p-1 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button></div>)}</div>
            ) : (
              <div className="space-y-3"><div><label className="mb-1 block text-xs font-medium text-muted-foreground">Customer name</label><input value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerProfileId(undefined); }} placeholder="Customer name" className="w-full rounded-lg border px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label><input value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setCustomerProfileId(undefined); }} placeholder="Phone" className="w-full rounded-lg border px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label><input value={customerEmail} onChange={(e) => { setCustomerEmail(e.target.value); setCustomerProfileId(undefined); }} placeholder="Email (optional)" className="w-full rounded-lg border px-3 py-2 text-sm" /></div>{searchingCustomers && <p className="text-xs text-muted-foreground">Searching customers…</p>}{customerMatches.map((customer) => <button key={customer.id} type="button" onClick={() => chooseCustomer(customer)} className="w-full rounded-lg border p-3 text-left hover:bg-muted"><p className="text-sm font-semibold">{customer.name}</p><p className="text-xs text-muted-foreground">{customer.phone || customer.email || ""} · {customer.orders} orders</p></button>)}{customerProfileId && <p className="text-xs font-medium text-primary">Customer profile linked.</p>}</div>
            )}
          </div>

          <div className="space-y-3 border-t p-4">
            <div className="flex gap-2"><div className="relative flex-1"><Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input placeholder="Add discount code" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" /></div><button type="button" className="rounded-lg border px-3 text-sm font-medium hover:bg-muted">Apply</button></div>
            <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currency} {subtotal.toLocaleString()}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{currency} 0</span></div>{estimatedCommission > 0 && <><div className="flex justify-between text-xs text-muted-foreground"><span>Platform commission ({commissionRatePercent}%)</span><span>-{currency} {estimatedCommission.toLocaleString()}</span></div><div className="flex justify-between text-xs text-muted-foreground"><span>Yours to keep</span><span>{currency} {netToKeep.toLocaleString()}</span></div></>}</div>
            <div className="flex items-center justify-between rounded-xl bg-primary/5 px-3 py-3"><span className="text-base font-semibold">Total</span><span className="text-xl font-bold text-primary">{currency} {subtotal.toLocaleString()}</span></div>
            <div className="grid grid-cols-3 gap-2">{posTenderTypes.map((t) => { const Icon = t === "Cash" ? Banknote : t === "Card" ? CreditCard : Landmark; return <button key={t} type="button" onClick={() => setTenderType(t)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-medium ${tenderType === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Icon className="h-4 w-4" />{t}</button>; })}</div>
            <button type="button" onClick={handleCharge} disabled={!cart.length || charging} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{charging ? "Charging…" : `Charge ${currency} ${subtotal.toLocaleString()}  ›`}</button>
            <button type="button" disabled className="w-full rounded-xl border py-2.5 text-sm font-medium text-muted-foreground">Save as Draft</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
