"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Lock, Minus, Plus, RotateCcw, ShoppingBag, Truck } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import { toast } from "sonner";

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
  categoryName,
  type,
  rentalUnit,
  inStock,
  variants = [],
  related = [],
  accent,
  ink,
  radius,
}: {
  storeSlug: string;
  productId: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  images: string[];
  description: string;
  categoryName: string | null;
  type: string;
  rentalUnit: string | null;
  inStock: boolean;
  variants?: { id: string; label: string; optionValues: Record<string, string>; price: number | null; quantity: number; images: string[] }[];
  related?: RelatedProduct[];
  accent: string;
  ink: string;
  radius: string;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const { requireSignedIn } = useShopAuthGate(storeSlug);
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

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

  const tracksStock = type === "PHYSICAL" || type === "RENTAL";
  const canBuy = variants.length > 0 ? Boolean(selectedVariant && selectedVariant.quantity > 0) : (tracksStock ? inStock : true);
  const hasDiscount = compareAtPrice !== null && compareAtPrice > effectivePrice;
  const discountPct = hasDiscount ? Math.round((1 - effectivePrice / (compareAtPrice as number)) * 100) : 0;
  const base = `/store/${storeSlug}`;

  function handleAdd(thenCheckout = false) {
    if (!requireSignedIn("add items to your cart")) return;
    if (variants.length > 0 && !selectedVariant) { toast.error("Choose your options first."); return; }
    addItem(storeSlug, { productId, variantId: selectedVariant?.id ?? null, variantLabel: selectedVariant?.label ?? null, optionValues: selectedVariant?.optionValues ?? null, name, price: effectivePrice, currency, image: effectiveImage }, qty);
    toast.success(`Added ${qty} × ${name} to cart`);
    setAdded(true);
    if (thenCheckout) router.push(`${base}/checkout`);
  }

  const outOfStock = !inStock && tracksStock;

  return (
    <div className="pd-wrap" style={{ ["--pd-accent" as string]: accent, ["--pd-ink" as string]: ink, ["--pd-radius" as string]: radius }}>
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
              <img src={galleryImages[active]} alt={name} />
            ) : (
              <span className="pd-noimg">{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="pd-thumbs">
              {galleryImages.map((img, i) => (
                <button key={img + i} type="button" onClick={() => setActive(i)} className={active === i ? "on" : ""} aria-label={`Show image ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <div className="pd-meta">
            {categoryName && <span className="pd-cat">{categoryName}</span>}
            {tracksStock && (
              <span className={`pd-stock ${outOfStock ? "out" : "in"}`}><i />{outOfStock ? "Out of stock" : "In stock"}</span>
            )}
          </div>
          <h1 className="pd-title">{name}</h1>

          <div className="pd-price">
            <strong>{currency} {effectivePrice.toLocaleString()}</strong>
            {hasDiscount && <s>{currency} {(compareAtPrice as number).toLocaleString()}</s>}
            {hasDiscount && <em>Save {currency} {((compareAtPrice as number) - effectivePrice).toLocaleString()}</em>}
            {type === "RENTAL" && rentalUnit && <span className="pd-unit">/ {rentalUnit}</span>}
          </div>

          {description && <p className="pd-desc">{description}</p>}

          {variants.length > 0 && (
            <div className="pd-variants">
              {optionGroups.map(([group, values]) => (
                <div key={group}>
                  <div className="pd-label">{group}{selectedVariant?.optionValues[group] ? <span>: {selectedVariant.optionValues[group]}</span> : null}</div>
                  <div className="pd-chips">
                    {values.map((value) => {
                      const candidate = variants.find((v) => v.optionValues[group] === value && (!selectedVariant || Object.entries(selectedVariant.optionValues).every(([k, val]) => k === group || !v.optionValues[k] || v.optionValues[k] === val)));
                      const on = selectedVariant?.optionValues[group] === value;
                      return (
                        <button type="button" key={value} className={on ? "on" : ""} disabled={!candidate}
                          onClick={() => { if (!candidate) return; setSelectedVariantId(candidate.id); setActive(0); }}>
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {selectedVariant && <div className="pd-avail">{selectedVariant.label} · {selectedVariant.quantity} available</div>}
            </div>
          )}

          {outOfStock ? (
            <div className="pd-oos">This item is currently out of stock.</div>
          ) : (
            <>
              <div className="pd-buy">
                <div className="pd-qty" role="group" aria-label="Quantity">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus size={16} /></button>
                  <span>{qty}</span>
                  <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity"><Plus size={16} /></button>
                </div>
                <button type="button" className="pd-add" onClick={() => handleAdd(false)} disabled={!canBuy}>
                  <ShoppingBag size={18} /> Add to cart · {currency} {(effectivePrice * qty).toLocaleString()}
                </button>
              </div>
              <button type="button" className="pd-now" onClick={() => handleAdd(true)} disabled={!canBuy}>Buy it now</button>

              {added && (
                <div className="pd-added" role="status">
                  <span><Check size={16} /> Added to your cart</span>
                  <div><Link href={`${base}/cart`}>View cart</Link><Link href={`${base}/checkout`}>Checkout →</Link></div>
                </div>
              )}
            </>
          )}

          <ul className="pd-trust">
            <li><Lock size={16} /><div><b>Secure checkout</b><small>Paid through the store&apos;s configured gateway</small></div></li>
            <li><Truck size={16} /><div><b>Delivery</b><small>Options and costs shown at checkout</small></div></li>
            <li><RotateCcw size={16} /><div><b>Returns</b><small><Link href={`${base}/policies`}>See the store policy</Link></small></div></li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="pd-related">
          <div className="pd-rel-head"><h2>More from this store</h2><Link href={`${base}/catalog`}>View all →</Link></div>
          <div className="pd-rel-grid">
            {related.map((p) => (
              <Link key={p.id} href={`${base}/product/${p.id}`} className="pd-rel-card">
                <div>{p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt={p.name} /> : <span>{p.name.charAt(0).toUpperCase()}</span>}</div>
                <b>{p.name}</b>
                <small>{p.currency} {p.price.toLocaleString()}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!outOfStock && (
        <div className="pd-mobilebar">
          <div><small>Total</small><b>{currency} {(effectivePrice * qty).toLocaleString()}</b></div>
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
.pd-badge{position:absolute;top:16px;left:16px;z-index:1;background:var(--pd-accent);color:#fff;font-weight:800;font-size:13px;padding:6px 12px;border-radius:999px}
.pd-thumbs{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
.pd-thumbs button{width:68px;height:68px;padding:0;border-radius:12px;overflow:hidden;cursor:pointer;background:none;border:2px solid transparent;outline:1px solid var(--bd);transition:.15s}
.pd-thumbs button.on{border-color:var(--pd-accent);outline-color:transparent}
.pd-thumbs img{width:100%;height:100%;object-fit:cover;display:block}
.pd-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.pd-cat{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--pd-accent);background:color-mix(in srgb,var(--pd-accent) 10%,transparent);padding:5px 11px;border-radius:999px}
.pd-stock{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700}
.pd-stock i{width:8px;height:8px;border-radius:50%;background:currentColor}
.pd-stock.in{color:#15803d}.pd-stock.out{color:#b91c1c}
.pd-title{font-size:clamp(28px,3.6vw,42px);line-height:1.1;font-weight:800;letter-spacing:-.02em;margin:0 0 18px;overflow-wrap:anywhere}
.pd-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:12px;margin-bottom:22px}
.pd-price strong{font-size:clamp(28px,3vw,36px);font-weight:800;letter-spacing:-.01em}
.pd-price s{font-size:17px;color:var(--soft)}
.pd-price em{font-style:normal;font-size:12.5px;font-weight:800;color:#15803d;background:#dcfce7;padding:4px 10px;border-radius:999px}
.pd-unit{font-size:14px;color:var(--soft)}
.pd-desc{font-size:15.5px;line-height:1.75;color:color-mix(in srgb,var(--pd-ink) 78%,transparent);white-space:pre-wrap;overflow-wrap:anywhere;padding:18px 0;margin:0 0 22px;border-top:1px solid var(--bd);border-bottom:1px solid var(--bd)}
.pd-variants{display:grid;gap:18px;margin-bottom:24px}
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
.pd-add,.pd-now{border-radius:var(--pd-radius);font-weight:800;font-size:15.5px;cursor:pointer;transition:transform .15s,box-shadow .15s,opacity .15s}
.pd-add{flex:1;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;background:var(--pd-accent);color:#fff;border:0;box-shadow:0 12px 28px -12px var(--pd-accent)}
.pd-add:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 16px 32px -12px var(--pd-accent)}
.pd-now{width:100%;margin-top:12px;min-height:50px;background:transparent;color:var(--pd-ink);border:1.5px solid var(--pd-ink)}
.pd-now:hover:not(:disabled){background:var(--pd-ink);color:#fff}
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
 .pd-mobilebar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:40;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:#fff;color:#11131a;border-top:1px solid rgba(0,0,0,.1);box-shadow:0 -8px 24px -12px rgba(0,0,0,.2)}
 .pd-mobilebar small{display:block;font-size:11px;color:#6b7280}
 .pd-mobilebar b{font-size:18px}
 .pd-mobilebar button{flex:1;max-width:220px;min-height:48px;border:0;border-radius:var(--pd-radius);background:var(--pd-accent);color:#fff;font-weight:800;font-size:15px;cursor:pointer}
 .pd-mobilebar button:disabled{opacity:.5}
}
`;
