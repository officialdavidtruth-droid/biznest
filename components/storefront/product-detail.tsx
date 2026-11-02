"use client";

import { ApproxPrice } from "@/components/storefront/approx-price";
import { RichText } from "@/components/storefront/rich-text";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Lock, Minus, Plus, RotateCcw, ShoppingBag, Truck } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { toast } from "sonner";
import { formatNumber } from "@/lib/i18n/locale";

/** Black or white, whichever is more readable on `hex`; white if it isn't a plain hex colour. */
function readableOn(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#111" : "#fff";
}

export type RelatedProduct = { id: string; name: string; price: number; currency: string; image: string | null };

export function ProductDetail({
  storeSlug,
  productId,
  name,
  price,
  compareAtPrice,
  currency,
  images,
  description,
  detailedDescription = "",
  categoryName,
  type,
  rentalUnit,
  inStock,
  stock = null,
  preorder = null,
  variants = [],
  related = [],
  accent,
  ink,
  radius,
  bg,
}: {
  storeSlug: string;
  productId: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  images: string[];
  description: string;
  /** Merchant's long-form description (small markdown subset), shown below the buy box. */
  detailedDescription?: string;
  categoryName: string | null;
  type: string;
  rentalUnit: string | null;
  inStock: boolean;
  /** Units left for a PHYSICAL product without variants; null when untracked. */
  stock?: number | null;
  /** Set when the product is sold as a pre-order: stock is ignored; spotsLeft null = no cap. */
  preorder?: { shipsOn: string | null; spotsLeft: number | null } | null;
  variants?: { id: string; label: string; optionValues: Record<string, string>; price: number | null; quantity: number; images: string[] }[];
  related?: RelatedProduct[];
  accent: string;
  ink: string;
  radius: string;
  /** Store page background, used by the mobile bar so it matches dark themes. */
  bg?: string;
}) {
  const router = useRouter();
  const { addItem, setQuantity, items: cartItems, storeSlug: cartStoreSlug } = useCart();
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const variantsRef = useRef<HTMLDivElement>(null);
  const [needsOptions, setNeedsOptions] = useState(false);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const effectivePrice = selectedVariant?.price ?? price;
  const galleryImages = selectedVariant?.images?.length ? selectedVariant.images : images;
  const effectiveImage = galleryImages[0] ?? null;
  const optionGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const v of variants) for (const [key, value] of Object.entries(v.optionValues)) {
      const values = groups.get(key) ?? [];
      if (!values.includes(value)) values.push(value);
      groups.set(key, values);
    }
    return [...groups.entries()];
  }, [variants]);

  // Picks the variant to select when a shopper taps `value` in `group`. It keeps as many
  // of their other current choices as it can (so Size M + Red, then tapping Blue, stays on
  // M if "M / Blue" exists), and otherwise falls back to the closest combination instead
  // of disabling the chip. Ties prefer an in-stock variant.
  const pickVariant = (group: string, value: string) => {
    const pool = variants.filter((v) => v.optionValues[group] === value);
    if (pool.length === 0) return null;
    const current = selectedVariant?.optionValues ?? {};
    const kept = (v: (typeof variants)[number]) => Object.entries(current).filter(([k, val]) => k !== group && v.optionValues[k] === val).length;
    return [...pool].sort((a, b) => kept(b) - kept(a) || Number(b.quantity > 0) - Number(a.quantity > 0))[0];
  };

  // Only PHYSICAL products have a stock count (the admin form hides quantity for
  // rentals/digital, and checkout only enforces stock for PHYSICAL), so only they
  // get an In stock / Out of stock badge.
  const tracksStock = type === "PHYSICAL";
  const canBuy = preorder ? (variants.length > 0 ? Boolean(selectedVariant) : true) : variants.length > 0 ? Boolean(selectedVariant && selectedVariant.quantity > 0) : (tracksStock ? inStock : true);
  // How many the shopper can add: the selected variant's stock, or the product's stock
  // when it has no variants. null = no cap (digital/rental, or no variant chosen yet).
  const maxQty = preorder ? preorder.spotsLeft : tracksStock ? (variants.length > 0 ? (selectedVariant ? selectedVariant.quantity : null) : stock) : null;
  // Derived, so the count also shrinks when a variant with less stock is selected.
  const quantity = maxQty != null && maxQty > 0 ? Math.min(qty, maxQty) : qty;
  const lowStock = !preorder && maxQty != null && maxQty > 0 && maxQty <= 5;
  // compareAtPrice belongs to the product, and variants have no compare-at of their
  // own. A variant with its own price is a different price point, so comparing it to
  // the product's compare-at would show a made-up discount (or hide a real one).
  const usesBasePrice = !selectedVariant || selectedVariant.price == null;
  const hasDiscount = usesBasePrice && compareAtPrice !== null && compareAtPrice > effectivePrice;
  const discountPct = hasDiscount ? Math.round((1 - effectivePrice / (compareAtPrice as number)) * 100) : 0;
  const base = `/store/${storeSlug}`;

  function handleAdd(thenCheckout = false) {
    // No sign-in needed to add to the cart: it lives in the browser, and checkout
    // (page and createOrder) is where a customer account is required.
    if (variants.length > 0 && !selectedVariant) {
      toast.error("Choose your options first.");
      // The options can be far above the sticky mobile bar, so bring them into view.
      const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      variantsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      setNeedsOptions(true);
      setTimeout(() => setNeedsOptions(false), 2000);
      return;
    }
    const variantId = selectedVariant?.id ?? null;
    // "Buy it now" means "buy this quantity", so if the line is already in the cart, set it to
    // the chosen quantity instead of adding on top (which would double it).
    const inCart = thenCheckout && cartStoreSlug === storeSlug && cartItems.some((i) => i.productId === productId && (i.variantId ?? null) === variantId);
    if (inCart) setQuantity(productId, quantity, variantId);
    else addItem(storeSlug, { productId, variantId: selectedVariant?.id ?? null, variantLabel: selectedVariant?.label ?? null, optionValues: selectedVariant?.optionValues ?? null, name, price: effectivePrice, currency, image: effectiveImage }, quantity);
    toast.success(`Added ${quantity} × ${name} to cart`);
    setAdded(true);
    if (thenCheckout) router.push(`${base}/checkout`);
  }

  const preorderFull = Boolean(preorder && preorder.spotsLeft === 0);
  const outOfStock = preorderFull || (!preorder && !inStock && tracksStock);

  return (
    <div className="pd-wrap" style={{ ["--pd-accent" as string]: accent, ["--pd-ink" as string]: ink, ["--pd-radius" as string]: radius, ["--pd-bg" as string]: bg ?? "#fff", ["--pd-on-accent" as string]: readableOn(accent) }}>
      <nav className="pd-crumbs" aria-label="Breadcrumb">
        <Link href={base}>Home</Link><ChevronRight size={13} />
        <Link href={`${base}/catalog`}>Shop</Link><ChevronRight size={13} />
        {categoryName && <><Link href={`${base}/catalog?category=${encodeURIComponent(categoryName)}`}>{categoryName}</Link><ChevronRight size={13} /></>}
        <span aria-current="page">{name}</span>
      </nav>

      <div className="pd-grid">
        <div className="pd-gallery">
          <div className="pd-stage">
            {hasDiscount && <span className="pd-badge">-{discountPct}%</span>}
            {galleryImages[active] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={galleryImages[active]} alt={name} fetchPriority="high" decoding="async" />
            ) : (
              <span className="pd-noimg">{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="pd-thumbs">
              {galleryImages.map((img, i) => (
                <button key={img + i} type="button" onClick={() => setActive(i)} className={active === i ? "on" : ""} aria-pressed={active === i} aria-label={`Show image ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <div className="pd-meta">
            {categoryName && <span className="pd-cat">{categoryName}</span>}
            {tracksStock && (
              <span className={`pd-stock ${outOfStock ? "out" : "in"}`}><i />{preorderFull ? "Pre-orders full" : preorder ? `Pre-order${preorder.shipsOn ? ` · ships by ${preorder.shipsOn}` : ""}` : outOfStock ? "Out of stock" : lowStock && variants.length === 0 ? `Only ${maxQty} left` : "In stock"}</span>
            )}
          </div>
          <h1 className="pd-title">{name}</h1>

          <div className="pd-price">
            <strong>{currency} {formatNumber(effectivePrice)}</strong>
            <div style={{ flexBasis: "100%" }}><ApproxPrice amount={effectivePrice} currency={currency} picker /></div>
            {hasDiscount && <s>{currency} {formatNumber((compareAtPrice as number))}</s>}
            {hasDiscount && <em>Save {currency} {formatNumber(((compareAtPrice as number) - effectivePrice))}</em>}
            {type === "RENTAL" && rentalUnit && <span className="pd-unit">/ {rentalUnit}</span>}
          </div>

          {description && <p className="pd-desc">{description}</p>}

          {variants.length > 0 && (
            <div ref={variantsRef} className={`pd-variants${needsOptions ? " need" : ""}`}>
              {optionGroups.map(([group, values]) => (
                <div key={group}>
                  <div className="pd-label">{group}{selectedVariant?.optionValues[group] ? <span>: {selectedVariant.optionValues[group]}</span> : null}</div>
                  <div className="pd-chips">
                    {values.map((value) => {
                      const candidate = pickVariant(group, value);
                      const on = selectedVariant?.optionValues[group] === value;
                      return (
                        <button type="button" key={value} className={on ? "on" : ""} aria-pressed={on} disabled={!candidate}
                          onClick={() => { if (!candidate) return; setSelectedVariantId(candidate.id); setActive(0); }}>
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {selectedVariant && <div className="pd-avail">{selectedVariant.label} · {preorder ? "available to pre-order" : `${selectedVariant.quantity} available`}</div>}
            </div>
          )}

          {outOfStock ? (
            <div className="pd-oos">{preorderFull ? "Pre-orders for this item are full." : "This item is currently out of stock."}</div>
          ) : (
            <>
              <div className="pd-buy">
                <div className="pd-qty" role="group" aria-label="Quantity">
                  <button type="button" onClick={() => setQty(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="Decrease quantity"><Minus size={16} /></button>
                  <span aria-live="polite">{quantity}</span>
                  <button type="button" onClick={() => setQty(maxQty != null ? Math.min(maxQty, quantity + 1) : quantity + 1)} disabled={maxQty != null && quantity >= maxQty} aria-label="Increase quantity"><Plus size={16} /></button>
                </div>
                <button type="button" className="pd-add" onClick={() => handleAdd(false)} disabled={!canBuy}>
                  <ShoppingBag size={18} /> {preorder ? "Pre-order" : "Add to cart"} · {currency} {formatNumber((effectivePrice * quantity))}
                </button>
              </div>
              <button type="button" className="pd-now" onClick={() => handleAdd(true)} disabled={!canBuy}>{preorder ? "Pre-order now" : "Buy it now"}</button>

              {added && (
                <div className="pd-added" role="status">
                  <span><Check size={16} /> Added to your cart</span>
                  <div><Link href={`${base}/cart`}>View cart</Link><Link href={`${base}/checkout`}>Checkout →</Link></div>
                </div>
              )}
            </>
          )}

          <ul className="pd-trust">
            <li><Lock size={16} /><div><b>Secure checkout</b><small>Choose from the payment methods this store accepts</small></div></li>
            {type !== "DIGITAL" && <li><Truck size={16} /><div><b>Delivery</b><small>Options and costs shown at checkout</small></div></li>}
            <li><RotateCcw size={16} /><div><b>Returns</b><small><Link href={`${base}/policies`}>See the store policy</Link></small></div></li>
          </ul>
        </div>
      </div>

      {detailedDescription.trim() && (
      <section className="pd-long">
        <h2>About this {type === "PHYSICAL" ? "product" : "item"}</h2>
        <RichText text={detailedDescription} />
      </section>
      )}
      {related.length > 0 && (
        <section className="pd-related">
          <div className="pd-rel-head"><h2>More from this store</h2><Link href={`${base}/catalog`}>View all →</Link></div>
          <div className="pd-rel-grid">
            {related.map((p) => (
              <Link key={p.id} href={`${base}/product/${p.id}`} className="pd-rel-card">
                <div>{p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt={p.name} loading="lazy" decoding="async" /> : <span>{p.name.charAt(0).toUpperCase()}</span>}</div>
                <b>{p.name}</b>
                <small>{p.currency} {formatNumber(p.price)}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!outOfStock && (
        <div className="pd-mobilebar">
          <div><small>Total</small><b>{currency} {formatNumber((effectivePrice * quantity))}</b></div>
          <button type="button" onClick={() => handleAdd(false)} disabled={!canBuy}>Add to cart</button>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.pd-wrap{--bd:color-mix(in srgb,var(--pd-ink) 14%,transparent);--tint:color-mix(in srgb,var(--pd-ink) 5%,transparent);--soft:color-mix(in srgb,var(--pd-ink) 62%,transparent);max-width:1120px;margin:0 auto;color:var(--pd-ink)}
.pd-wrap *{box-sizing:border-box}
.pd-wrap :focus-visible{outline:2px solid var(--pd-accent);outline-offset:2px}
.pd-wrap a{color:inherit;text-decoration:none}
.pd-crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12.5px;color:var(--soft);margin-bottom:26px}
.pd-crumbs a:hover{color:var(--pd-accent)}
.pd-crumbs span{color:var(--pd-ink);font-weight:600;overflow-wrap:anywhere}
.pd-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:56px;align-items:start}
.pd-gallery{position:sticky;top:24px}
.pd-stage{position:relative;aspect-ratio:1/1;width:100%;border-radius:calc(var(--pd-radius) + 6px);overflow:hidden;background:var(--tint);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;box-shadow:0 18px 50px -24px color-mix(in srgb,var(--pd-ink) 45%,transparent)}
.pd-stage img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
.pd-stage:hover img{transform:scale(1.04)}
.pd-noimg{font-size:72px;font-weight:800;opacity:.2}
.pd-badge{position:absolute;top:16px;left:16px;z-index:1;background:var(--pd-accent);color:var(--pd-on-accent);font-weight:800;font-size:13px;padding:6px 12px;border-radius:999px}
.pd-thumbs{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
.pd-thumbs button{width:68px;height:68px;padding:0;border-radius:12px;overflow:hidden;cursor:pointer;background:none;border:2px solid transparent;outline:1px solid var(--bd);transition:.15s}
.pd-thumbs button.on{border-color:var(--pd-accent);outline-color:transparent}
.pd-thumbs img{width:100%;height:100%;object-fit:cover;display:block}
.pd-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.pd-cat{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--pd-accent);background:color-mix(in srgb,var(--pd-accent) 10%,transparent);padding:5px 11px;border-radius:999px}
.pd-stock{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700}
.pd-stock i{width:8px;height:8px;border-radius:50%;background:currentColor}
.pd-stock.in{color:color-mix(in srgb,#15803d 62%,var(--pd-ink))}.pd-stock.out{color:color-mix(in srgb,#b91c1c 62%,var(--pd-ink))}
.pd-title{font-size:clamp(28px,3.6vw,42px);line-height:1.1;font-weight:800;letter-spacing:-.02em;margin:0 0 18px;overflow-wrap:anywhere}
.pd-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:12px;margin-bottom:22px}
.pd-price strong{font-size:clamp(28px,3vw,36px);font-weight:800;letter-spacing:-.01em}
.pd-price s{font-size:17px;color:var(--soft)}
.pd-price em{font-style:normal;font-size:12.5px;font-weight:800;color:#15803d;background:#dcfce7;padding:4px 10px;border-radius:999px}
.pd-unit{font-size:14px;color:var(--soft)}
.pd-long{margin:32px 0 8px;max-width:760px}.pd-long h2{font-size:20px;margin:0 0 12px}.pd-long p,.pd-long li{font-size:15.5px;line-height:1.75;overflow-wrap:anywhere;color:color-mix(in srgb,var(--pd-ink) 82%,transparent)}.pd-long p{margin:0 0 14px}.pd-long ul{list-style:disc;padding-left:22px;margin:0 0 14px}.pd-long ol{list-style:decimal;padding-left:22px;margin:0 0 14px}
.pd-desc{font-size:15.5px;line-height:1.75;color:color-mix(in srgb,var(--pd-ink) 78%,transparent);white-space:pre-wrap;overflow-wrap:anywhere;padding:18px 0;margin:0 0 22px;border-top:1px solid var(--bd);border-bottom:1px solid var(--bd)}
.pd-variants{display:grid;gap:18px;margin-bottom:24px;transition:outline-color .2s}
.pd-variants.need{outline:2px solid var(--pd-accent);outline-offset:8px;border-radius:var(--pd-radius)}
.pd-label{font-size:13px;font-weight:800;margin-bottom:9px}
.pd-label span{font-weight:500;color:var(--soft)}
.pd-chips{display:flex;flex-wrap:wrap;gap:9px}
.pd-chips button{padding:10px 16px;border-radius:calc(var(--pd-radius) - 2px);border:1.5px solid var(--bd);background:transparent;color:var(--pd-ink);font-weight:600;font-size:14px;cursor:pointer;transition:.15s}
.pd-chips button:hover:not(:disabled){border-color:var(--pd-accent)}
.pd-chips button.on{border-color:var(--pd-accent);background:color-mix(in srgb,var(--pd-accent) 10%,transparent);color:var(--pd-accent)}
.pd-chips button:disabled{opacity:.4;cursor:not-allowed;text-decoration:line-through}
.pd-avail{font-size:13px;color:var(--soft)}
.pd-buy{display:flex;gap:12px;align-items:stretch}
.pd-qty{display:flex;align-items:center;border:1.5px solid var(--bd);border-radius:var(--pd-radius);flex:none}
.pd-qty button{width:44px;height:100%;min-height:54px;border:0;background:transparent;color:var(--pd-ink);cursor:pointer;display:grid;place-items:center}
.pd-qty button:hover{color:var(--pd-accent)}
.pd-qty span{min-width:28px;text-align:center;font-weight:800;font-size:16px}
.pd-qty button:disabled{opacity:.35;cursor:not-allowed}
.pd-qty button:disabled:hover{color:var(--pd-ink)}
.pd-add,.pd-now{border-radius:var(--pd-radius);font-weight:800;font-size:15.5px;cursor:pointer;transition:transform .15s,box-shadow .15s,opacity .15s}
.pd-add{flex:1;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;background:var(--pd-accent);color:var(--pd-on-accent);border:0;box-shadow:0 12px 28px -12px var(--pd-accent)}
.pd-add:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 16px 32px -12px var(--pd-accent)}
.pd-now{width:100%;margin-top:12px;min-height:50px;background:transparent;color:var(--pd-ink);border:1.5px solid var(--pd-ink)}
.pd-now:hover:not(:disabled){background:var(--tint);border-color:var(--pd-accent);color:var(--pd-accent)}
.pd-add:disabled,.pd-now:disabled{opacity:.5;cursor:not-allowed}
.pd-oos{padding:14px 18px;border-radius:var(--pd-radius);background:#fee2e2;color:#991b1b;font-weight:700;font-size:14px}
.pd-added{margin-top:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 16px;border-radius:var(--pd-radius);background:#dcfce7;color:#166534;font-size:14px;font-weight:700}
.pd-added span{display:inline-flex;align-items:center;gap:8px}
.pd-added div{display:flex;gap:16px}
.pd-added a{text-decoration:underline!important}
.pd-trust{list-style:none;margin:28px 0 0;padding:0;display:grid;gap:0;border:1px solid var(--bd);border-radius:calc(var(--pd-radius) + 2px);overflow:hidden}
.pd-trust li{display:flex;gap:14px;align-items:center;padding:15px 18px;border-bottom:1px solid var(--bd)}
.pd-trust li:last-child{border-bottom:0}
.pd-trust svg{color:var(--pd-accent);flex:none}
.pd-trust b{display:block;font-size:14px}
.pd-trust small{color:var(--soft);font-size:12.5px}
.pd-trust small a{text-decoration:underline!important}
.pd-related{margin-top:72px}
.pd-rel-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px}
.pd-rel-head h2{font-size:24px;font-weight:800;margin:0}
.pd-rel-head a{font-size:14px;font-weight:700;color:var(--pd-accent)}
.pd-rel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}
.pd-rel-card{display:block}
.pd-rel-card div{aspect-ratio:1/1;border-radius:calc(var(--pd-radius) + 2px);overflow:hidden;background:var(--tint);border:1px solid var(--bd);display:grid;place-items:center;font-size:40px;font-weight:800;color:var(--soft);margin-bottom:12px}
.pd-rel-card img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.pd-rel-card:hover img{transform:scale(1.05)}
.pd-rel-card b{display:block;font-size:15px;overflow-wrap:anywhere}
.pd-rel-card small{font-size:14px;color:var(--soft)}
.pd-mobilebar{display:none}
@media (max-width:820px){
 .pd-grid{grid-template-columns:1fr;gap:28px}
 .pd-gallery{position:static}
 .pd-wrap{padding-bottom:84px}
 .pd-buy .pd-add{display:none}
 .pd-buy{justify-content:flex-start}
 .pd-mobilebar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:40;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:var(--pd-bg);color:var(--pd-ink);border-top:1px solid var(--bd);box-shadow:0 -8px 24px -12px rgba(0,0,0,.25)}
 .pd-mobilebar small{display:block;font-size:11px;color:var(--soft)}
 .pd-mobilebar b{font-size:18px}
 .pd-mobilebar button{flex:1;max-width:220px;min-height:48px;border:0;border-radius:var(--pd-radius);background:var(--pd-accent);color:var(--pd-on-accent);font-weight:800;font-size:15px;cursor:pointer}
 .pd-mobilebar button:disabled{opacity:.5}
}
`;
