"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, ScanBarcode, Minus, Plus, Trash2, X, ShoppingBag, Banknote, CreditCard, ArrowLeftRight, UserRound, ChevronDown, Receipt, Loader2, PackageX, WifiOff } from "lucide-react";
import { createPosSale, lookupPosBarcode, searchPosCustomers, type PosCatalogItem, type PosCustomerMatch } from "@/lib/actions/pos";
import { posTenderTypes } from "@/lib/validations/pos";
import type { InHouseReservation } from "@/lib/actions/folio";
import type { PosTabSummary } from "@/lib/actions/pos-tabs";
import { roundMoney } from "@/lib/utils/pricing";
import { formatNumber } from "@/lib/i18n/locale";
import {
  enqueueSale,
  isConnectionError,
  listQueue,
  removeQueuedSale,
  saveCatalog,
  syncQueue,
  type QueuedSale,
} from "@/lib/pos-offline";

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
  showOrderType = true,
  inHouseRooms = [],
  openTabs = [],
  onSaleComplete,
}: {
  slug: string;
  catalog: PosCatalogItem[];
  commissionRatePercent: number;
  /** Dine-in/takeaway + table fields. Only meaningful for restaurant/food stores. */
  showOrderType?: boolean;
  /** Checked-in guests the sale can be charged to (hotels/apartments). Empty hides "Charge to room". */
  inHouseRooms?: InHouseReservation[];
  /** Tables with a running bill, so a waiter can pick one and see what it's already at. */
  openTabs?: PosTabSummary[];
  /** Called after a sale is saved, for hosts that hold the tab list in their own state. */
  onSaleComplete?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "product" | "service">("all");
  const [customerOpen, setCustomerOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [pickingVariantsFor, setPickingVariantsFor] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tenderType, setTenderType] = useState<(typeof posTenderTypes)[number]>("Cash");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [tableLabel, setTableLabel] = useState("");
  // Pay now, or put it on an account settled later: a table's running bill, or a guest's room.
  const [chargeMode, setChargeMode] = useState<"NOW" | "TABLE" | "ROOM">("NOW");
  const [reservationId, setReservationId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerProfileId, setCustomerProfileId] = useState<string | undefined>();
  const [customerMatches, setCustomerMatches] = useState<PosCustomerMatch[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [charging, setCharging] = useState(false);
  // One key per completed register charge. Keep it stable across network/UI
  // retries so a lost response cannot create a second POS order.
  const chargeIdempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  // Sales rung up with no connection, waiting to be recorded. See lib/pos-offline.ts.
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const syncingRef = useRef(false);

  async function runSync() {
    if (syncingRef.current) return;
    if (listQueue(slug).filter((q) => !q.error).length === 0) return setQueue(listQueue(slug));
    syncingRef.current = true;
    setSyncing(true);
    try {
      const res = await syncQueue(slug, (input) => createPosSale(slug, input));
      setQueue(listQueue(slug));
      if (res.synced > 0) {
        toast.success(`${res.synced} offline ${res.synced === 1 ? "sale" : "sales"} recorded.`);
        router.refresh();
      }
      if (res.failed > 0) toast.error(`${res.failed} offline ${res.failed === 1 ? "sale was" : "sales were"} not accepted. See the list below the register.`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  // Keep an offline copy of the catalogue, and replay queued sales on load and whenever the connection returns.
  useEffect(() => {
    if (catalog.length > 0) saveCatalog(slug, catalog);
  }, [slug, catalog]);

  useEffect(() => {
    setQueue(listQueue(slug));
    setOnline(navigator.onLine);
    const goOnline = () => { setOnline(true); void runSync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) void runSync();
    const timer = setInterval(() => { if (navigator.onLine) void runSync(); }, 60_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // The key must identify ONE specific sale. If the cashier changes the cart,
  // tender or customer after a failed attempt, that is a different sale, so it
  // gets a new key (otherwise the server would replay the earlier order).
  useEffect(() => {
    chargeIdempotencyKeyRef.current = crypto.randomUUID();
  }, [cart, tenderType, orderType, tableLabel, chargeMode, reservationId, customerName, customerPhone, customerEmail, customerProfileId]);

  const currency = catalog[0]?.currency ?? "NGN";

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
      if (!cancelled) setCustomerMatches(matches);
      if (!cancelled) setSearchingCustomers(false);
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
    if (!q) return catalog;
    return catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.barcode?.toLowerCase().includes(q)
    );
  }, [catalog, query]);

  const visible = useMemo(() => (kindFilter === "all" ? filtered : filtered.filter((item) => item.kind === kindFilter)), [filtered, kindFilter]);

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

  // A USB/Bluetooth barcode scanner just types digits + Enter into whatever
  // element currently has focus -- it has no idea a "scan barcode" field
  // exists. Focus it on load, and refocus it any time the cashier clicks
  // something else on the register (a product tile, a qty button, etc.)
  // that isn't itself a text field, so the very next scan always lands
  // in the right place without the cashier having to click into it first.
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  function refocusBarcodeUnlessTyping(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const isTextField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
    if (!isTextField) {
      setTimeout(() => barcodeInputRef.current?.focus(), 0);
    }
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
      maxQuantity: result.quantity, // same stock cap as tapping the tile; the charge step still enforces it
    });
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const estimatedCommission = roundMoney(subtotal * (commissionRatePercent / 100));
  const netToKeep = roundMoney(subtotal - estimatedCommission);

  const canTab = showOrderType;
  const canRoom = inHouseRooms.length > 0;
  const currentTab = chargeMode === "TABLE" ? openTabs.find((t) => t.label.toLowerCase() === tableLabel.trim().replace(/\s+/g, " ").toLowerCase()) : undefined;
  const chosenRoom = inHouseRooms.find((r) => r.id === reservationId);

  async function handleCharge() {
    if (cart.length === 0 || charging) return;
    if (chargeMode === "TABLE" && !tableLabel.trim()) return toast.error("Enter the table to add this to.");
    if (chargeMode === "ROOM" && !reservationId) return toast.error("Choose the room to charge.");
    setCharging(true);
    let result: Awaited<ReturnType<typeof createPosSale>>;
    try {
    result = await createPosSale(slug, {
      items: cart.map((l) => ({
        productId: l.variantId ? undefined : l.productId,
        variantId: l.variantId,
        serviceId: l.serviceId,
        quantity: l.quantity,
      })),
      tenderType,
      orderType,
      tableLabel: tableLabel.trim() || undefined,
      chargeTo: chargeMode === "TABLE" ? { kind: "TABLE" } : chargeMode === "ROOM" ? { kind: "ROOM", reservationId } : undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerProfileId,
      idempotencyKey: chargeIdempotencyKeyRef.current,
    });
    } catch (err) {
      // Network drop. A plain sale (not a table tab or room charge, which need the server) is saved
      // on this device with its idempotency key and recorded automatically once back online.
      if (chargeMode === "NOW" && isConnectionError(err)) {
        const total = roundMoney(cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
        enqueueSale(slug, {
          key: chargeIdempotencyKeyRef.current,
          input: {
            items: cart.map((l) => ({ productId: l.variantId ? undefined : l.productId, variantId: l.variantId, serviceId: l.serviceId, quantity: l.quantity })),
            tenderType,
            orderType,
            tableLabel: tableLabel.trim() || undefined,
            customerName: customerName.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            customerEmail: customerEmail.trim() || undefined,
            customerProfileId,
          },
          total,
          currency,
          createdAt: Date.now(),
        });
        setQueue(listQueue(slug));
        toast.success(`Saved offline — ${currency} ${formatNumber(total)}. It will be recorded when you're back online.`);
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setCustomerProfileId(undefined);
        setCustomerMatches([]);
        setOrderType("DINE_IN");
        setTableLabel("");
        chargeIdempotencyKeyRef.current = crypto.randomUUID();
        return;
      }
      // Table or room charge, or a server error: keep the cart and the SAME idempotency key so
      // pressing Charge again cannot create a second order if the first one landed.
      toast.error("Couldn't reach the server. Check your connection and press Charge again — you won't be charged twice.");
      return;
    } finally {
      setCharging(false);
    }
    if (!result.success) return toast.error(result.error);
    toast.success(
      chargeMode === "TABLE"
        ? `Added ${currency} ${formatNumber(result.data.total)} to ${tableLabel.trim()}'s tab.`
        : chargeMode === "ROOM"
          ? `Charged ${currency} ${formatNumber(result.data.total)} to room ${chosenRoom?.roomName ?? ""}.`
          : `Sale complete — ${currency} ${formatNumber(result.data.total)}`,
    );
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setOrderType("DINE_IN");
    setTableLabel("");
    setChargeMode("NOW");
    setReservationId("");
    setCustomerEmail("");
    setCustomerProfileId(undefined);
    setCustomerMatches([]);
    chargeIdempotencyKeyRef.current = crypto.randomUUID();
    router.refresh();
    onSaleComplete?.();
  }

  // ---- display helpers (no sale logic below this line) ----
  const productCount = catalog.filter((i) => i.kind === "product").length;
  const serviceCount = catalog.length - productCount;
  const showKindFilter = productCount > 0 && serviceCount > 0;
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const inCartFor = (item: PosCatalogItem) =>
    cart.reduce((sum, l) => {
      const match = item.kind === "service" ? l.serviceId === item.id : l.productId === item.id;
      return match ? sum + l.quantity : sum;
    }, 0);
  const tenderIcons = { Cash: Banknote, Card: CreditCard, Transfer: ArrowLeftRight } as const;
  const hasCustomer = Boolean(customerName || customerPhone || customerEmail || customerProfileId);
  const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--bn-admin-orange)_45%,transparent)]";
  const fieldClass = `h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-[var(--bn-admin-orange)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--bn-admin-orange)_25%,transparent)]`;
  const chargeLabel = charging
    ? "Charging…"
    : chargeMode === "TABLE"
      ? `Add to ${tableLabel.trim() || "table"} tab`
      : chargeMode === "ROOM"
        ? `Charge to room${chosenRoom ? ` ${chosenRoom.roomName}` : ""}`
        : "Charge";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start" onClickCapture={refocusBarcodeUnlessTyping}>
      {(!online || queue.length > 0) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-semibold">
              {!online && <WifiOff className="h-4 w-4" />}
              {!online ? "You're offline. Sales are saved on this device." : "Offline sales waiting to be recorded."}
              {queue.length > 0 && ` ${queue.length} waiting.`}
            </p>
            {online && queue.length > 0 && (
              <button type="button" onClick={() => void runSync()} disabled={syncing} className="rounded-full bg-amber-900 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {syncing ? "Recording…" : "Record now"}
              </button>
            )}
          </div>
          {queue.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {queue.map((q) => (
                <li key={q.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {new Date(q.createdAt).toLocaleTimeString()} · {q.currency} {formatNumber(q.total)} · {q.input.tenderType}
                    {q.error ? ` — not accepted: ${q.error}` : ""}
                  </span>
                  {q.error && (
                    <button type="button" onClick={() => setQueue(removeQueuedSale(slug, q.key))} className="font-semibold underline">
                      Discard
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Catalog */}
      <section className="min-w-0 pb-24 lg:pb-0" aria-label="Items to sell">
        <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/90 px-1 pb-3 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, SKU or barcode"
                aria-label="Search products and services"
                className={`h-12 w-full rounded-2xl border bg-background pl-11 pr-10 text-[15px] shadow-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-[var(--bn-admin-orange)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--bn-admin-orange)_25%,transparent)]`}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <form onSubmit={handleBarcodeSubmit} className="relative sm:w-56 sm:shrink-0">
              <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--bn-admin-orange)]" />
              <input
                ref={barcodeInputRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder={lookingUpBarcode ? "Looking up…" : "Scan barcode"}
                aria-label="Scan barcode"
                autoFocus
                disabled={lookingUpBarcode}
                className="h-12 w-full rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--bn-admin-orange)_45%,transparent)] bg-[var(--bn-admin-orange-soft)]/60 pl-11 pr-3 text-[15px] outline-none transition-shadow placeholder:text-[var(--bn-admin-orange)]/70 focus:border-solid focus:border-[var(--bn-admin-orange)] focus:bg-background focus:ring-2 focus:ring-[color-mix(in_srgb,var(--bn-admin-orange)_25%,transparent)]"
              />
            </form>
          </div>
          <div className="flex items-center justify-between gap-3">
            {showKindFilter ? (
              <div role="tablist" aria-label="Filter items" className="inline-flex rounded-full bg-muted p-1 text-sm">
                {([["all", `All ${catalog.length}`], ["product", `Products ${productCount}`], ["service", `Services ${serviceCount}`]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={kindFilter === value}
                    onClick={() => setKindFilter(value)}
                    className={`rounded-full px-3.5 py-1 font-medium transition-colors ${ring} ${kindFilter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{catalog.length} {catalog.length === 1 ? "item" : "items"}</p>
            )}
            {(query || kindFilter !== "all") && <p className="text-xs text-muted-foreground">{visible.length} shown</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => {
            const outOfStock = !item.hasVariants && item.quantity !== null && item.quantity <= 0;
            const lowStock = !item.hasVariants && item.quantity !== null && item.quantity > 0 && item.quantity <= 5;
            const inCart = inCartFor(item);
            return (
              <div key={`${item.kind}:${item.id}`} className="relative">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addProduct(item)}
                  className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-background text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--bn-admin-orange)_45%,transparent)] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm ${ring} ${inCart > 0 ? "border-[var(--bn-admin-orange)] ring-1 ring-[var(--bn-admin-orange)]" : ""}`}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-muted to-muted/40">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" loading="lazy" className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    {inCart > 0 && (
                      <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--bn-admin-orange)] px-1.5 text-xs font-bold text-white shadow">
                        {inCart}
                      </span>
                    )}
                    {item.kind === "service" && (
                      <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-sm">Service</span>
                    )}
                    {outOfStock && (
                      <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-[1px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-white"><PackageX className="h-3.5 w-3.5" />Out of stock</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.name}</p>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                      <div>
                        <p className="text-[15px] font-bold leading-none text-[var(--bn-admin-orange)]">
                          <span className="mr-1 text-[11px] font-semibold text-muted-foreground">{item.currency}</span>
                          {formatNumber(item.price)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.hasVariants ? "Several options" : lowStock ? <span className="font-semibold text-amber-700">Only {item.quantity} left</span> : item.quantity !== null && !outOfStock ? `${item.quantity} in stock` : " "}
                        </p>
                      </div>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)] transition-colors group-hover:bg-[var(--bn-admin-orange)] group-hover:text-white">
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </button>

                {pickingVariantsFor === item.id && (
                  <div className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-2xl border bg-background p-2 shadow-xl">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="px-1.5 text-xs font-semibold text-muted-foreground">Choose an option</p>
                      <button type="button" onClick={() => setPickingVariantsFor(null)} aria-label="Close options" className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="max-h-56 space-y-0.5 overflow-y-auto">
                      {item.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          disabled={v.quantity <= 0}
                          onClick={() => addVariant(item, v.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-[var(--bn-admin-orange-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="font-medium">{v.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.currency} {formatNumber(v.price)} · {v.quantity <= 0 ? "sold out" : `${v.quantity} left`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed py-14 text-center">
              <Search className="h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm font-medium">{catalog.length === 0 ? "Nothing to sell yet" : "No matching items"}</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {catalog.length === 0 ? "Add products or services and they will show up here, ready to ring up." : "Try a different name, SKU or barcode, or clear the search."}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Cart */}
      <aside id="pos-cart" aria-label="Current sale" className="flex flex-col rounded-3xl border bg-background shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]"><ShoppingBag className="h-[18px] w-[18px]" /></span>
            <div>
              <h2 className="text-base font-bold leading-tight">Current sale</h2>
              <p className="text-xs text-muted-foreground">{itemCount === 0 ? "No items yet" : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}</p>
            </div>
          </div>
          {cart.length > 0 && (
            <button type="button" onClick={() => setCart([])} className={`rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive ${ring}`}>
              Clear all
            </button>
          )}
        </div>

        <div className="px-3">
          {cart.length === 0 ? (
            <div className="mx-2 flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-9 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-muted"><ShoppingBag className="h-5 w-5 text-muted-foreground/60" /></span>
              <p className="text-sm font-semibold">Cart is empty</p>
              <p className="text-xs text-muted-foreground">Tap an item, or scan a barcode, to add it.</p>
            </div>
          ) : (
            <ul className="max-h-[36vh] space-y-1.5 overflow-y-auto pr-1">
              {cart.map((line) => (
                <li key={line.key} className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{currency} {formatNumber(line.unitPrice)} each</p>
                  </div>
                  <div className="flex items-center rounded-full border bg-background">
                    <button type="button" onClick={() => updateQuantity(line.key, -1)} aria-label={`Remove one ${line.name}`} className={`grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted ${ring}`}>
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(line.key, 1)} aria-label={`Add one ${line.name}`} className={`grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted ${ring}`}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-[4.5rem] text-right">
                    <p className="text-sm font-bold tabular-nums">{formatNumber(roundMoney(line.unitPrice * line.quantity))}</p>
                    <button type="button" onClick={() => removeLine(line.key)} aria-label={`Remove ${line.name}`} className="mt-0.5 inline-flex items-center text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 space-y-4 border-t px-5 pb-4 pt-4">
          {/* Customer */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCustomerOpen((open) => !open)}
              aria-expanded={customerOpen || hasCustomer}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${ring}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><UserRound className="h-4 w-4" /></span>
                <span className="truncate font-medium">{customerName.trim() || (hasCustomer ? "Customer details" : "Add customer")}</span>
                {!hasCustomer && <span className="text-xs text-muted-foreground">optional</span>}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${customerOpen || hasCustomer ? "rotate-180" : ""}`} />
            </button>
            {(customerOpen || hasCustomer) && (
              <div className="relative mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={customerName}
                    onChange={(e) => { setCustomerName(e.target.value); setCustomerProfileId(undefined); }}
                    placeholder="Customer name"
                    aria-label="Customer name"
                    className={fieldClass}
                  />
                  <input
                    value={customerPhone}
                    onChange={(e) => { setCustomerPhone(e.target.value); setCustomerProfileId(undefined); }}
                    placeholder="Phone"
                    aria-label="Customer phone"
                    inputMode="tel"
                    className={fieldClass}
                  />
                </div>
                <input
                  value={customerEmail}
                  onChange={(e) => { setCustomerEmail(e.target.value); setCustomerProfileId(undefined); }}
                  placeholder="Email (optional)"
                  aria-label="Customer email"
                  type="email"
                  className={fieldClass}
                />
                {(customerMatches.length > 0 || searchingCustomers) && (
                  <div className="absolute bottom-full left-0 right-0 z-30 mb-1 overflow-hidden rounded-2xl border bg-background shadow-xl">
                    {searchingCustomers && <div className="px-3 py-2 text-xs text-muted-foreground">Searching customers…</div>}
                    {customerMatches.map((customer) => (
                      <button key={customer.id} type="button" onClick={() => chooseCustomer(customer)} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left text-xs last:border-0 hover:bg-[var(--bn-admin-orange-soft)]">
                        <span className="min-w-0 truncate"><b className="text-sm">{customer.name}</b><span className="ml-2 text-muted-foreground">{customer.phone || customer.email || ""}</span></span>
                        <span className="shrink-0 text-muted-foreground">{customer.orders} orders · {currency} {formatNumber(customer.spent)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {customerProfileId && <p className="rounded-lg bg-[var(--bn-admin-orange-soft)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--bn-admin-orange)]">Customer profile linked. This sale will appear in Customer 360.</p>}
              </div>
            )}
          </div>

          {showOrderType && (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground" id="pos-order-type-label">Order type</p>
                {/* Big tap targets instead of a native <select>: easier to hit on touch screens and always works in installed-app webviews. */}
                <div role="radiogroup" aria-labelledby="pos-order-type-label" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
                  {([["DINE_IN", "Dine in"], ["TAKEAWAY", "Takeaway"], ["DELIVERY", "Delivery"]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={orderType === value}
                      onClick={() => setOrderType(value)}
                      className={`min-h-10 rounded-xl px-2 text-sm font-medium transition ${ring} ${orderType === value ? "bg-background text-[var(--bn-admin-orange)] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Table / reference
                <input list="pos-open-tables" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder={orderType === "DINE_IN" || chargeMode === "TABLE" ? "Table 12" : "Optional"} className={`${fieldClass} mt-1.5 font-normal`} />
                <datalist id="pos-open-tables">{openTabs.map((t) => <option key={t.id} value={t.label} />)}</datalist>
              </label>
            </div>
          )}

          {(canTab || canRoom) && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground" id="pos-charge-mode-label">Payment</p>
              <div role="radiogroup" aria-labelledby="pos-charge-mode-label" className="grid gap-1 rounded-2xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${1 + Number(canTab) + Number(canRoom)}, minmax(0, 1fr))` }}>
                {([["NOW", "Pay now", true], ["TABLE", "Table tab", canTab], ["ROOM", "Room", canRoom]] as const)
                  .filter(([, , shown]) => shown)
                  .map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={chargeMode === value}
                      onClick={() => { setChargeMode(value); if (value === "TABLE") setOrderType("DINE_IN"); }}
                      className={`min-h-10 rounded-xl px-2 text-sm font-medium transition ${ring} ${chargeMode === value ? "bg-background text-[var(--bn-admin-orange)] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
              </div>
              {chargeMode === "TABLE" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {currentTab
                    ? `${currentTab.label} is already at ${currency} ${formatNumber(currentTab.total)}. This adds to it. Take payment from the open tabs list below.`
                    : "Opens a running bill for this table. Keep adding orders; take payment once at the end."}
                </p>
              )}
              {chargeMode === "ROOM" && (
                <select value={reservationId} onChange={(e) => setReservationId(e.target.value)} aria-label="Room to charge" className={`${fieldClass} mt-2`}>
                  <option value="">Choose room…</option>
                  {inHouseRooms.map((r) => (
                    <option key={r.id} value={r.id}>Room {r.roomName} · {r.guestName}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {chargeMode === "NOW" && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground" id="pos-tender-label">Paid by</p>
              <div role="radiogroup" aria-labelledby="pos-tender-label" className="grid grid-cols-3 gap-2">
                {posTenderTypes.map((t) => {
                  const Icon = tenderIcons[t as keyof typeof tenderIcons] ?? Banknote;
                  const active = tenderType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTenderType(t)}
                      className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs font-semibold transition ${ring} ${active ? "border-[var(--bn-admin-orange)] bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)] shadow-sm" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Total + charge stay in view while the rest of the panel scrolls */}
        <div className="sticky bottom-0 mt-auto rounded-b-3xl border-t bg-background/95 px-5 pb-5 pt-4 backdrop-blur">
          <div className="flex items-end justify-between">
            <span className="text-sm font-medium text-muted-foreground">{chargeMode === "NOW" ? "Total to collect" : chargeMode === "TABLE" ? "Add to tab" : "Charge to room"}</span>
            <span className="text-right">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">{currency}</span>
              <span className="text-3xl font-extrabold tabular-nums tracking-tight">{formatNumber(subtotal)}</span>
            </span>
          </div>
          {estimatedCommission > 0 && (
            <details className="group mt-2 text-xs text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium hover:text-foreground">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                Fees and what you keep
              </summary>
              <div className="mt-2 space-y-1 rounded-xl bg-muted/50 p-3">
                <div className="flex items-center justify-between"><span>Platform commission ({commissionRatePercent}%)</span><span>-{currency} {formatNumber(estimatedCommission)}</span></div>
                <div className="flex items-center justify-between font-semibold text-foreground"><span>Yours to keep</span><span>{currency} {formatNumber(netToKeep)}</span></div>
                <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground/90">
                  {chargeMode === "NOW" ? "Cash is collected in full. Commission is tracked and settled separately (see Payments)." : "Nothing is collected yet; the guest pays the whole bill later. Commission is tracked now and settled separately (see Payments)."}
                </p>
              </div>
            </details>
          )}
          <button
            type="button"
            onClick={handleCharge}
            disabled={cart.length === 0 || charging}
            className={`mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bn-admin-orange)] text-base font-bold text-white shadow-md shadow-[color-mix(in_srgb,var(--bn-admin-orange)_30%,transparent)] transition hover:bg-[var(--bn-admin-orange-dark)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none ${ring}`}
          >
            {charging ? <Loader2 className="h-5 w-5 animate-spin" /> : <Receipt className="h-5 w-5" />}
            {chargeLabel}
            {!charging && chargeMode === "NOW" && cart.length > 0 && <span className="tabular-nums">{currency} {formatNumber(subtotal)}</span>}
          </button>
        </div>
      </aside>

      {/* Phone: jump to the cart without scrolling the whole catalogue */}
      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById("pos-cart")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-2xl bg-[var(--bn-admin-orange)] px-5 py-3.5 text-white shadow-xl lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-5 w-5" />{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          <span className="text-base font-bold tabular-nums">View cart · {currency} {formatNumber(subtotal)}</span>
        </button>
      )}
    </div>
  );
}
