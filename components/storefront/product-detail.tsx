"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, Heart, MapPin, ShieldCheck, ShoppingBag, Star, Utensils } from "lucide-react";
import { GrandeurHeader, GrandeurFooter } from "@/components/storefront/grandeur-restaurant";

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
  accent: string;
  ink: string;
  radius: string;
}) {
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

  const canBuy = variants.length > 0 ? Boolean(selectedVariant && selectedVariant.quantity > 0) : (type === "PHYSICAL" || type === "RENTAL" ? inStock : true);

  function handleAdd() {
    if (!requireSignedIn("add items to your cart")) return;
    if (variants.length > 0 && !selectedVariant) { toast.error("Choose your options first."); return; }
    addItem(storeSlug, { productId, variantId: selectedVariant?.id ?? null, variantLabel: selectedVariant?.label ?? null, optionValues: selectedVariant?.optionValues ?? null, name, price: effectivePrice, currency, image: effectiveImage }, qty);
    toast.success(`Added ${qty} × ${name} to cart`);
    setAdded(true);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 32, maxWidth: 880, margin: "0 auto" }} className="pd-grid">
      <div>
        {/* maxWidth/maxHeight are a safety net: this column is `1fr` of
            whatever wraps it, so if a template's outer container is ever
            missing its own maxWidth cap (as rivora-chrome.tsx was), the
            1/1 aspect-ratio box below would otherwise scale up with the
            viewport and produce an oversized square product photo. */}
        <div style={{ aspectRatio: "1/1", maxWidth: 400, maxHeight: 400, margin: "0 auto", borderRadius: radius, overflow: "hidden", background: `${ink}0d`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {galleryImages[active] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={galleryImages[active]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 40, opacity: 0.3 }}>{name.charAt(0)}</span>
          )}
        </div>
        {galleryImages.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {galleryImages.map((img, i) => (
              <button
                key={img + i}
                onClick={() => setActive(i)}
                style={{
                  width: 56, height: 56, borderRadius: 8, overflow: "hidden", padding: 0, cursor: "pointer",
                  border: active === i ? `2px solid ${accent}` : `1px solid ${ink}22`, background: "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {categoryName && (
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>
            {categoryName}
          </div>
        )}
        <h1 style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 800, marginBottom: 12, color: ink }}>{name}</h1>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: ink }}>{currency} {effectivePrice.toLocaleString()}</span>
          {compareAtPrice && compareAtPrice > price && (
            <span style={{ fontSize: 15, color: `${ink}66`, textDecoration: "line-through" }}>{currency} {compareAtPrice.toLocaleString()}</span>
          )}
          {type === "RENTAL" && rentalUnit && <span style={{ fontSize: 13, color: `${ink}88` }}>/ {rentalUnit}</span>}
        </div>

        {description && (
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: `${ink}bb`, marginBottom: 24, whiteSpace: "pre-wrap" }}>{description}</p>
        )}

        {variants.length > 0 && (
          <div style={{ display: "grid", gap: 16, marginBottom: 22 }}>
            {optionGroups.map(([group, values]) => (
              <div key={group}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: ink }}>{group}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {values.map((value) => {
                    const candidate = variants.find((v) => v.optionValues[group] === value && (!selectedVariant || Object.entries(selectedVariant.optionValues).every(([k, val]) => k === group || !v.optionValues[k] || v.optionValues[k] === val)));
                    const active = selectedVariant?.optionValues[group] === value;
                    return <button type="button" key={value} onClick={() => { if (!candidate) return; setSelectedVariantId(candidate.id); setActive(0); }} disabled={!candidate} style={{ padding: "9px 13px", borderRadius: 8, border: active ? `2px solid ${accent}` : `1px solid ${ink}22`, background: active ? `${accent}12` : "transparent", color: ink, opacity: candidate ? 1 : .45, cursor: candidate ? "pointer" : "not-allowed" }}>{value}</button>;
                  })}
                </div>
              </div>
            ))}
            {selectedVariant && <div style={{ fontSize: 13, color: `${ink}99` }}>{selectedVariant.label} · {selectedVariant.quantity} available</div>}
          </div>
        )}

        {!inStock && (type === "PHYSICAL" || type === "RENTAL") ? (
          <div style={{ padding: "12px 16px", borderRadius: radius, background: `${ink}0d`, fontSize: 13.5, fontWeight: 600, color: ink }}>
            Currently out of stock
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: ink }}>Quantity</span>
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${ink}22`, borderRadius: radius, overflow: "hidden" }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtnStyle(ink)}>−</button>
                <span style={{ width: 36, textAlign: "center", fontSize: 14, fontWeight: 700, color: ink }}>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} style={qtyBtnStyle(ink)}>+</button>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!canBuy}
              style={{
                width: "100%", background: accent, color: "#fff", border: 0, padding: "14px", borderRadius: radius,
                fontWeight: 700, fontSize: 14.5, cursor: canBuy ? "pointer" : "not-allowed", opacity: canBuy ? 1 : 0.5,
              }}
            >
              Add to cart — {currency} {(effectivePrice * qty).toLocaleString()}
            </button>

            {added && (
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/store/${storeSlug}/cart`} style={{ fontSize: 13, fontWeight: 700, color: accent, textDecoration: "underline" }}>
                  View cart →
                </Link>
                <Link href={`/store/${storeSlug}/checkout`} style={{ fontSize: 13, fontWeight: 700, color: ink, textDecoration: "underline" }}>
                  Checkout now →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@media (max-width:720px){.pd-grid{grid-template-columns:1fr !important}}`}</style>
    </div>
  );
}

function qtyBtnStyle(ink: string): CSSProperties {
  return { width: 34, height: 34, border: "none", background: "transparent", fontSize: 17, fontWeight: 700, color: ink, cursor: "pointer" };
}


type GrandeurProduct = {
  id: string;
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
  variants: { id: string; label: string; optionValues: Record<string, string>; price: number | null; quantity: number; images: string[] }[];
  reviews: { id: string; rating: number; comment: string | null; createdAt: string; authorName: string; response: string | null }[];
};

/**
 * Restaurant product page: deliberately lives inside the Grandeur storefront
 * shell so a menu item never feels like it belongs to a different website.
 * Store branding, banner, typography, navigation, product imagery and footer
 * all come from the actual merchant/template data.
 */
export function GrandeurProductDetail({ store, slug, product, relatedProducts = [] }: { store: any; slug: string; product: GrandeurProduct; relatedProducts?: { id: string; name: string; price: number; currency: string; image: string | null; compareAtPrice: number | null }[] }) {
  const { addItem } = useCart();
  const { requireSignedIn } = useShopAuthGate(slug);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [tab, setTab] = useState<"description" | "details" | "reviews">("description");
  const [liked, setLiked] = useState(false);

  const selectedVariant = product.variants.find(v => v.id === selectedVariantId) || null;
  const gallery = selectedVariant?.images?.length ? selectedVariant.images : product.images;
  const safeGallery = gallery.length ? gallery : [store.bannerUrl].filter(Boolean);
  const currentImage = safeGallery[active] || safeGallery[0] || "";
  const price = selectedVariant?.price ?? product.price;
  const compare = product.compareAtPrice && product.compareAtPrice > price ? product.compareAtPrice : null;
  const discount = compare ? Math.round((1 - price / compare) * 100) : 0;
  const rating = product.reviews.length ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length : null;
  const optionGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    product.variants.forEach(v => Object.entries(v.optionValues).forEach(([key, value]) => {
      const values = map.get(key) || [];
      if (!values.includes(value)) values.push(value);
      map.set(key, values);
    }));
    return [...map.entries()];
  }, [product.variants]);
  const address = [store.business?.city, store.business?.state, store.business?.country].filter(Boolean).join(", ");
  const businessName = store.name || "This Restaurant";
  const canBuy = product.variants.length ? Boolean(selectedVariant && selectedVariant.quantity > 0) : product.inStock;
  const money = (n: number) => `${product.currency === "NGN" ? "₦" : product.currency + " "}${Math.round(n).toLocaleString()}`;

  function chooseVariant(group: string, value: string) {
    const candidate = product.variants.find(v => v.optionValues[group] === value && Object.entries(v.optionValues).every(([k, val]) => k === group || !selectedVariant?.optionValues[k] || selectedVariant.optionValues[k] === val));
    if (candidate) { setSelectedVariantId(candidate.id); setActive(0); }
  }

  function addToCart() {
    if (!requireSignedIn("add items to your cart")) return;
    if (product.variants.length && !selectedVariant) { toast.error("Choose your options first."); return; }
    addItem(slug, { productId: product.id, variantId: selectedVariant?.id ?? null, variantLabel: selectedVariant?.label ?? null, optionValues: selectedVariant?.optionValues ?? null, name: product.name, price, currency: product.currency, image: currentImage }, qty);
    setAdded(true);
    toast.success(`${product.name} added to your cart`);
  }

  return (
    <div className="gr-site gr-product-page">
      <GrandeurHeader store={store} slug={slug} active="menu" />

      <main>
        <div className="gr-product-breadcrumb">
          <Link href={`/store/${slug}`}>Home</Link><span>›</span><Link href={`/store/${slug}/catalog`}>Menu</Link><span>›</span><span>{product.name}</span>
          <Link className="gr-product-back" href={`/store/${slug}/catalog`}><ArrowLeft size={15}/> Back to Menu</Link>
        </div>

        <section className="gr-product-layout">
          <div className="gr-product-gallery">
            <div className="gr-product-main-image">
              {currentImage ? <img key={currentImage} src={currentImage} alt={product.name} onError={(e) => { const el = e.currentTarget; if (store.bannerUrl && el.src !== store.bannerUrl) el.src = store.bannerUrl; else el.style.display = "none"; }} /> : <div className="gr-product-image-fallback"><Utensils size={42}/><span>{product.name}</span></div>}
              {discount > 0 && <span className="gr-product-discount">{discount}% OFF</span>}
              <button type="button" className={`gr-product-like ${liked ? "active" : ""}`} aria-label={liked ? "Remove from favourites" : "Save item"} onClick={() => setLiked(v => !v)}><Heart size={20} fill={liked ? "currentColor" : "none"}/></button>
              {safeGallery.length > 1 && <><button className="gr-product-arrow left" type="button" onClick={() => setActive((active - 1 + safeGallery.length) % safeGallery.length)} aria-label="Previous image"><ChevronLeft/></button><button className="gr-product-arrow right" type="button" onClick={() => setActive((active + 1) % safeGallery.length)} aria-label="Next image"><ChevronRight/></button><span className="gr-product-count">{active + 1} / {safeGallery.length}</span></>}
            </div>
            {safeGallery.length > 1 && <div className="gr-product-thumbs">{safeGallery.map((src, i) => <button type="button" className={i === active ? "active" : ""} key={`${src}-${i}`} onClick={() => setActive(i)}><img src={src} alt="" /></button>)}</div>}
          </div>

          <aside className="gr-product-summary">
            <div className="gr-product-eyebrow">{product.categoryName || "MENU"}</div>
            <h1>{product.name}</h1>
            {rating !== null && <div className="gr-product-rating"><span>{"★".repeat(Math.round(rating))}</span><b>{rating.toFixed(1)}</b><a href="#reviews">({product.reviews.length} review{product.reviews.length === 1 ? "" : "s"})</a></div>}
            <p className="gr-product-description">{product.description || "A thoughtfully prepared selection from this restaurant."}</p>
            <div className="gr-product-price-row"><strong>{money(price)}</strong>{compare && <><del>{money(compare)}</del><span>{discount}% OFF</span></>}</div>

            {(address || store.phone) && <div className="gr-product-facts">{address && <span><MapPin/><b>Location<small>{address}</small></b></span>}<span><Clock3/><b>Availability<small>Check with {businessName}</small></b></span><span><Utensils/><b>Service<small>Dine-in & collection</small></b></span></div>}

            {optionGroups.length > 0 && <div className="gr-product-options">{optionGroups.map(([group, values]) => <div key={group}><b>{group}</b><div>{values.map(value => { const activeValue = selectedVariant?.optionValues[group] === value; const candidate = product.variants.find(v => v.optionValues[group] === value); return <button type="button" key={value} className={activeValue ? "active" : ""} disabled={!candidate} onClick={() => chooseVariant(group, value)}>{value}</button>; })}</div></div>)}</div>}

            {selectedVariant && <div className="gr-product-stock">{selectedVariant.quantity > 0 ? <><Check size={15}/> {selectedVariant.label} · {selectedVariant.quantity} available</> : "This option is currently unavailable"}</div>}

            {canBuy ? <>
              <div className="gr-product-buy-row"><span>Quantity</span><div className="gr-product-qty"><button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button><b>{qty}</b><button type="button" onClick={() => setQty(q => q + 1)}>+</button></div></div>
              <button type="button" className="gr-product-add" onClick={addToCart}><ShoppingBag size={18}/> Add to cart — {money(price * qty)}</button>
              {added && <div className="gr-product-after"><Link href={`/store/${slug}/cart`}>View cart <ArrowRight size={14}/></Link><Link href={`/store/${slug}/checkout`}>Checkout <ArrowRight size={14}/></Link></div>}
            </> : <div className="gr-product-unavailable">Currently unavailable</div>}

            <div className="gr-product-assurances"><span><ShieldCheck/><b>Secure payment<small>Processed by BizNest</small></b></span><span><Check/><b>Easy fulfilment<small>Delivery or collection</small></b></span><span><Clock3/><b>Need help?<small>Contact {businessName}</small></b></span></div>
          </aside>
        </section>

        <section className="gr-product-lower">
          <div className="gr-product-tabs"><button className={tab === "description" ? "active" : ""} onClick={() => setTab("description")}>Description</button><button className={tab === "details" ? "active" : ""} onClick={() => setTab("details")}>Details</button><button id="reviews" className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>Reviews ({product.reviews.length})</button></div>
          <div className="gr-product-content">
            {tab === "description" && <div><h2>About this dish</h2><p>{product.description || "This item is available directly from the restaurant. Details provided by the business will appear here."}</p></div>}
            {tab === "details" && <div><h2>Item details</h2><div className="gr-product-detail-list">{product.categoryName && <span><b>Category</b>{product.categoryName}</span>}<span><b>Currency</b>{product.currency}</span><span><b>Availability</b>{product.inStock ? "Available" : "Unavailable"}</span>{product.type && <span><b>Type</b>{product.type}</span>}</div></div>}
            {tab === "reviews" && <div className="gr-product-reviews">{product.reviews.length ? product.reviews.map(r => <article key={r.id}><div><b>{r.authorName}</b><span>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span><small>{new Date(r.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small></div><p>{r.comment || "No written comment."}</p>{r.response && <aside><b>Response from {businessName}</b><p>{r.response}</p></aside>}</article>) : <p>No reviews yet.</p>}</div>}
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="gr-product-related">
            <div className="gr-product-related-head"><div><span>MORE TO EXPLORE</span><h2>From {businessName}</h2></div><Link href={`/store/${slug}/catalog`}>View full menu <ArrowRight size={14}/></Link></div>
            <div className="gr-product-related-grid">
              {relatedProducts.map(item => (
                <Link href={`/store/${slug}/product/${item.id}`} className="gr-product-related-card" key={item.id}>
                  <div>{item.image ? <img src={item.image} alt={item.name} onError={(e) => { if (store.bannerUrl) e.currentTarget.src = store.bannerUrl; }} /> : <div className="gr-product-related-fallback"><Utensils size={22}/></div>}</div>
                  <section><h3>{item.name}</h3><p>{item.currency === "NGN" ? "₦" : item.currency + " "}{item.price.toLocaleString()}</p></section>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <GrandeurFooter store={store} slug={slug} />
    </div>
  );
}
