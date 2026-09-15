"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Heart, MapPin, Minus, Plus, ShoppingBag, ShieldCheck, Star, Truck, Utensils, Headphones, Share2 } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import { toast } from "sonner";

type Variant = {
  id: string;
  label: string;
  optionValues: Record<string, string>;
  price: number | null;
  quantity: number;
  images: string[];
};

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
  variants?: Variant[];
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
  const [liked, setLiked] = useState(false);
  const [tab, setTab] = useState<"description" | "details" | "reviews" | "related">("description");
  const [imageFailed, setImageFailed] = useState(false);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const effectivePrice = selectedVariant?.price ?? price;
  const galleryImages = selectedVariant?.images?.length ? selectedVariant.images : images;
  const currentImage = galleryImages[active] ?? galleryImages[0] ?? null;
  const comparePrice = compareAtPrice && compareAtPrice > effectivePrice ? compareAtPrice : null;
  const discount = comparePrice ? Math.round((1 - effectivePrice / comparePrice) * 100) : 0;

  const optionGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const variant of variants) {
      for (const [key, value] of Object.entries(variant.optionValues)) {
        const values = groups.get(key) ?? [];
        if (!values.includes(value)) values.push(value);
        groups.set(key, values);
      }
    }
    return [...groups.entries()];
  }, [variants]);

  const canBuy = variants.length > 0
    ? Boolean(selectedVariant && selectedVariant.quantity >= qty)
    : (type === "PHYSICAL" || type === "RENTAL" ? inStock : true);

  const categoryHref = categoryName
    ? `/store/${storeSlug}/category/${encodeURIComponent(categoryName)}`
    : `/store/${storeSlug}`;

  function selectOption(group: string, value: string) {
    const candidate = variants.find((variant) => {
      if (variant.optionValues[group] !== value || variant.quantity <= 0) return false;
      return optionGroups.every(([key]) => {
        if (key === group) return true;
        const selected = selectedVariant?.optionValues[key];
        return !selected || variant.optionValues[key] === selected;
      });
    });
    if (!candidate) return;
    setSelectedVariantId(candidate.id);
    setActive(0);
    setImageFailed(false);
  }

  function handleAdd() {
    if (!requireSignedIn("add items to your cart")) return;
    if (variants.length > 0 && !selectedVariant) {
      toast.error("Choose your options first.");
      return;
    }
    if (selectedVariant && selectedVariant.quantity < qty) {
      toast.error(`Only ${selectedVariant.quantity} available.`);
      return;
    }
    addItem(storeSlug, {
      productId,
      variantId: selectedVariant?.id ?? null,
      variantLabel: selectedVariant?.label ?? null,
      optionValues: selectedVariant?.optionValues ?? null,
      name,
      price: effectivePrice,
      currency,
      image: currentImage,
    }, qty);
    toast.success(`${qty} × ${name} added to your cart`);
    setAdded(true);
  }

  function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ title: name, url: window.location.href }).catch(() => undefined);
    } else if (typeof navigator !== "undefined") {
      void navigator.clipboard?.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  }

  return (
    <div
      className="bn-product-page"
      style={{
        "--bn-accent": accent,
        "--bn-ink": ink,
        "--bn-muted": `${ink}99`,
        "--bn-border": `${ink}18`,
        "--bn-card": "#ffffff",
        "--bn-bg": "#f8f5ef",
        "--bn-radius": radius,
      } as React.CSSProperties}
    >
      <header className="bn-product-header">
        <Link href={`/store/${storeSlug}`} className="bn-product-brand" aria-label="Back to store">
          <span className="bn-product-brand-mark">B</span>
          <span>
            <strong>BizNest</strong>
            <small>Store</small>
          </span>
        </Link>
        <nav className="bn-product-nav" aria-label="Store navigation">
          <Link href={`/store/${storeSlug}`}>Home</Link>
          <Link href={categoryHref}>{categoryName || "Shop"}</Link>
          <Link href={`/store/${storeSlug}/catalog`}>Explore</Link>
        </nav>
        <div className="bn-product-header-actions">
          <button type="button" className="bn-icon-button" onClick={share} aria-label="Share product"><Share2 size={18} /></button>
          <Link href={`/store/${storeSlug}/cart`} className="bn-cart-button"><ShoppingBag size={18} /><span>Cart</span></Link>
        </div>
      </header>

      <main className="bn-product-main">
        <div className="bn-breadcrumbs">
          <Link href={`/store/${storeSlug}`}>Home</Link><ChevronRight size={14} />
          <Link href={categoryHref}>{categoryName || "Shop"}</Link><ChevronRight size={14} />
          <span>{name}</span>
          <Link href={categoryHref} className="bn-back-link"><ArrowLeft size={14} /> Back</Link>
        </div>

        <section className="bn-product-layout">
          <div className="bn-gallery-column">
            <div className="bn-main-image">
              {currentImage && !imageFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentImage} alt={name} onError={() => setImageFailed(true)} />
              ) : (
                <div className="bn-image-fallback">
                  <span>{name.charAt(0).toUpperCase()}</span>
                  <small>{categoryName || "Premium selection"}</small>
                </div>
              )}
              {discount > 0 && <span className="bn-offer-badge">{discount}% OFF</span>}
              <button type="button" className={`bn-favorite ${liked ? "is-liked" : ""}`} onClick={() => setLiked((v) => !v)} aria-label={liked ? "Remove from favorites" : "Add to favorites"}>
                <Heart size={20} fill={liked ? "currentColor" : "none"} />
              </button>
              {galleryImages.length > 1 && <div className="bn-image-count">{active + 1} / {galleryImages.length}</div>}
              {galleryImages.length > 1 && (
                <>
                  <button type="button" className="bn-gallery-arrow bn-gallery-prev" onClick={() => { setActive((i) => (i - 1 + galleryImages.length) % galleryImages.length); setImageFailed(false); }} aria-label="Previous image"><ArrowLeft size={18} /></button>
                  <button type="button" className="bn-gallery-arrow bn-gallery-next" onClick={() => { setActive((i) => (i + 1) % galleryImages.length); setImageFailed(false); }} aria-label="Next image"><ArrowRight size={18} /></button>
                </>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="bn-thumbnails" aria-label="Product images">
                {galleryImages.map((img, index) => (
                  <button type="button" key={`${img}-${index}`} className={active === index ? "is-active" : ""} onClick={() => { setActive(index); setImageFailed(false); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`${name} ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="bn-product-card">
            <div className="bn-eyebrow"><span>{categoryName || "Featured"}</span>{discount > 0 && <em>Special offer</em>}</div>
            <h1>{name}</h1>
            <div className="bn-rating-row">
              <span className="bn-stars" aria-label="Rated product"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></span>
              <strong>New</strong>
              <span>Available now</span>
            </div>

            <div className="bn-price-row">
              <strong>{currency} {effectivePrice.toLocaleString()}</strong>
              {comparePrice && <span>{currency} {comparePrice.toLocaleString()}</span>}
              {type === "RENTAL" && rentalUnit && <small>/ {rentalUnit}</small>}
            </div>

            {description && <p className="bn-description">{description}</p>}

            <div className="bn-feature-strip">
              <div><Utensils size={19} /><span><b>Quality</b><small>Premium service</small></span></div>
              <div><Clock3 size={19} /><span><b>Availability</b><small>Available today</small></span></div>
              <div><MapPin size={19} /><span><b>Location</b><small>At this business</small></span></div>
            </div>

            {variants.length > 0 && (
              <div className="bn-options">
                {optionGroups.map(([group, values]) => (
                  <div key={group} className="bn-option-group">
                    <div className="bn-option-heading"><strong>{group}</strong><span>{selectedVariant?.optionValues[group] || "Select"}</span></div>
                    <div className="bn-option-values">
                      {values.map((value) => {
                        const selected = selectedVariant?.optionValues[group] === value;
                        const available = variants.some((variant) => variant.optionValues[group] === value && variant.quantity > 0);
                        return <button key={value} type="button" className={selected ? "is-selected" : ""} disabled={!available} onClick={() => selectOption(group, value)}>{value}</button>;
                      })}
                    </div>
                  </div>
                ))}
                {selectedVariant && <div className="bn-stock-note"><Check size={15} /> {selectedVariant.label} · {selectedVariant.quantity} available</div>}
              </div>
            )}

            {type === "PHYSICAL" || type === "RENTAL" ? (
              <div className="bn-purchase-row">
                <div className="bn-quantity">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus size={16} /></button>
                  <span>{qty}</span>
                  <button type="button" onClick={() => setQty((q) => Math.min(selectedVariant?.quantity || 99, q + 1))} aria-label="Increase quantity"><Plus size={16} /></button>
                </div>
                <span className="bn-quantity-label">Quantity</span>
              </div>
            ) : null}

            {!canBuy ? (
              <div className="bn-unavailable">{variants.length > 0 && !selectedVariant ? "Choose your options to continue" : "Currently unavailable"}</div>
            ) : (
              <button type="button" className="bn-add-button" onClick={handleAdd}>
                <ShoppingBag size={19} />
                <span>Add to cart</span>
                <b>— {currency} {(effectivePrice * qty).toLocaleString()}</b>
              </button>
            )}

            {added && (
              <div className="bn-added-row">
                <span><Check size={16} /> Added to your cart</span>
                <Link href={`/store/${storeSlug}/cart`}>View cart <ArrowRight size={14} /></Link>
              </div>
            )}

            <div className="bn-assurances">
              <div><ShieldCheck size={18} /><span><b>Secure payment</b><small>Safe & encrypted checkout</small></span></div>
              <div><Truck size={18} /><span><b>Easy fulfillment</b><small>Delivery or collection</small></span></div>
              <div><Headphones size={18} /><span><b>Need help?</b><small>Contact the business</small></span></div>
            </div>
          </aside>
        </section>

        <section className="bn-information-grid">
          <div className="bn-detail-panel">
            <div className="bn-tabs" role="tablist">
              <button type="button" className={tab === "description" ? "is-active" : ""} onClick={() => setTab("description")}>Description</button>
              <button type="button" className={tab === "details" ? "is-active" : ""} onClick={() => setTab("details")}>Details</button>
              <button type="button" className={tab === "reviews" ? "is-active" : ""} onClick={() => setTab("reviews")}>Reviews</button>
              <button type="button" className={tab === "related" ? "is-active" : ""} onClick={() => setTab("related")}>Related</button>
            </div>
            <div className="bn-tab-content">
              {tab === "description" && <><h2>About this {type === "PHYSICAL" ? "product" : "offering"}</h2><p>{description || `Discover ${name}, thoughtfully presented by ${storeSlug.replace(/-/g, " ")}.`}</p></>}
              {tab === "details" && <><h2>Product details</h2><div className="bn-detail-list"><div><span>Category</span><b>{categoryName || "General"}</b></div><div><span>Type</span><b>{type.replace(/_/g, " ")}</b></div>{selectedVariant && <div><span>Selected option</span><b>{selectedVariant.label}</b></div>}</div></>}
              {tab === "reviews" && <><h2>Customer reviews</h2><div className="bn-empty-detail"><Star size={22} /><p>Reviews will appear here once customers have shared their experience.</p></div></>}
              {tab === "related" && <><h2>You may also like</h2><div className="bn-empty-detail"><p>Explore the store for more products and services.</p><Link href={`/store/${storeSlug}/catalog`}>Explore catalog <ArrowRight size={15} /></Link></div></>}
            </div>
          </div>

          <div className="bn-love-card">
            <h2>Why you'll love it</h2>
            <div><Check size={17} /><span>Thoughtfully selected for a premium experience</span></div>
            <div><Check size={17} /><span>Clear pricing with secure checkout</span></div>
            <div><Check size={17} /><span>Support available when you need it</span></div>
            <div><Check size={17} /><span>Managed directly through BizNest</span></div>
          </div>
        </section>
      </main>

      <style jsx>{`
        .bn-product-page{min-height:100vh;background:var(--bn-bg);color:var(--bn-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.45}
        .bn-product-header{height:76px;background:#fff;border-bottom:1px solid var(--bn-border);display:flex;align-items:center;padding:0 clamp(20px,5vw,76px);gap:32px;position:sticky;top:0;z-index:20}
        .bn-product-brand{display:flex;align-items:center;gap:10px;color:var(--bn-ink);text-decoration:none;min-width:180px}.bn-product-brand-mark{width:40px;height:40px;border-radius:12px;background:var(--bn-accent);color:#fff;display:grid;place-items:center;font-weight:900;font-size:18px}.bn-product-brand strong{display:block;font-size:15px;letter-spacing:.08em;text-transform:uppercase}.bn-product-brand small{display:block;font-size:10px;color:var(--bn-muted);letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
        .bn-product-nav{display:flex;justify-content:center;gap:28px;flex:1}.bn-product-nav a{font-size:13px;font-weight:600;color:var(--bn-ink);text-decoration:none;opacity:.8}.bn-product-nav a:hover{opacity:1;color:var(--bn-accent)}
        .bn-product-header-actions{display:flex;align-items:center;gap:8px}.bn-icon-button,.bn-cart-button{height:40px;border:1px solid var(--bn-border);background:#fff;color:var(--bn-ink);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}.bn-icon-button{width:40px;cursor:pointer}.bn-cart-button{padding:0 14px;font-size:13px;font-weight:700}.bn-icon-button:hover,.bn-cart-button:hover{border-color:${accent};background:${accent}08}
        .bn-product-main{max-width:1280px;margin:0 auto;padding:28px 24px 70px}.bn-breadcrumbs{display:flex;align-items:center;gap:7px;color:var(--bn-muted);font-size:12px;margin-bottom:22px}.bn-breadcrumbs a{color:inherit;text-decoration:none}.bn-breadcrumbs a:hover{color:var(--bn-accent)}.bn-breadcrumbs span{color:var(--bn-ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bn-back-link{margin-left:auto;display:flex;align-items:center;gap:6px;font-weight:700!important;color:var(--bn-accent)!important}
        .bn-product-layout{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(430px,.92fr);gap:34px;align-items:start}.bn-gallery-column{min-width:0}.bn-main-image{height:min(620px,52vw);min-height:420px;border-radius:24px;background:#e9e4da;overflow:hidden;position:relative;display:grid;place-items:center;box-shadow:0 18px 50px rgba(20,25,20,.08)}.bn-main-image>img{width:100%;height:100%;object-fit:cover;display:block}.bn-image-fallback{width:100%;height:100%;display:grid;place-items:center;align-content:center;background:radial-gradient(circle at 30% 25%,#d8c6a1,#6d5940 48%,#171c19);color:#fff;text-align:center}.bn-image-fallback span{font-size:150px;line-height:1;font-family:Georgia,serif;font-weight:700;opacity:.85}.bn-image-fallback small{font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.8}.bn-offer-badge{position:absolute;left:20px;top:20px;background:var(--bn-accent);color:#fff;padding:9px 13px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em}.bn-favorite{position:absolute;right:20px;top:20px;width:44px;height:44px;border:1px solid rgba(255,255,255,.65);background:rgba(255,255,255,.94);border-radius:50%;display:grid;place-items:center;color:#263029;cursor:pointer}.bn-favorite.is-liked{color:#b34b45}.bn-image-count{position:absolute;right:20px;bottom:18px;background:rgba(0,0,0,.65);color:#fff;padding:7px 10px;border-radius:9px;font-size:11px}.bn-gallery-arrow{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border:0;border-radius:50%;background:rgba(255,255,255,.94);color:#18201b;display:grid;place-items:center;cursor:pointer}.bn-gallery-prev{left:16px}.bn-gallery-next{right:16px}.bn-gallery-arrow:hover{background:#fff;transform:translateY(-50%) scale(1.04)}
        .bn-thumbnails{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:12px}.bn-thumbnails button{height:92px;padding:0;border:2px solid transparent;border-radius:13px;overflow:hidden;background:#e8e3d9;cursor:pointer}.bn-thumbnails button.is-active{border-color:var(--bn-accent)}.bn-thumbnails img{width:100%;height:100%;object-fit:cover;display:block}
        .bn-product-card{background:#fff;border:1px solid var(--bn-border);border-radius:24px;padding:34px;box-shadow:0 16px 45px rgba(20,25,20,.06);position:sticky;top:98px}.bn-eyebrow{display:flex;align-items:center;gap:9px;margin-bottom:12px}.bn-eyebrow span{font-size:11px;color:var(--bn-accent);font-weight:900;letter-spacing:.13em;text-transform:uppercase}.bn-eyebrow em{font-style:normal;background:#edf6ef;color:#32704c;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800}.bn-product-card h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(32px,3vw,46px);line-height:1.05;margin:0 0 14px;letter-spacing:-.035em}.bn-rating-row{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--bn-muted);margin-bottom:23px}.bn-stars{display:flex;gap:2px;color:#bd8329}.bn-rating-row strong{color:var(--bn-ink)}.bn-price-row{display:flex;align-items:baseline;gap:12px;padding-bottom:22px;border-bottom:1px solid var(--bn-border)}.bn-price-row strong{font-size:30px;letter-spacing:-.03em}.bn-price-row span{font-size:15px;color:var(--bn-muted);text-decoration:line-through}.bn-price-row small{font-size:12px;color:var(--bn-muted)}.bn-description{font-size:14px;line-height:1.8;color:var(--bn-muted);margin:20px 0 22px}.bn-feature-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:17px 0;border-bottom:1px solid var(--bn-border);border-top:1px solid var(--bn-border)}.bn-feature-strip>div{display:flex;gap:9px;align-items:flex-start;color:var(--bn-accent)}.bn-feature-strip span{display:grid;gap:1px}.bn-feature-strip b{font-size:11px;color:var(--bn-ink)}.bn-feature-strip small{font-size:10px;color:var(--bn-muted)}
        .bn-options{padding-top:20px}.bn-option-group{margin-bottom:17px}.bn-option-heading{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:9px}.bn-option-heading span{color:var(--bn-muted)}.bn-option-values{display:flex;flex-wrap:wrap;gap:8px}.bn-option-values button{min-width:52px;padding:9px 13px;border-radius:9px;border:1px solid var(--bn-border);background:#fff;color:var(--bn-ink);font-size:12px;font-weight:700;cursor:pointer}.bn-option-values button:hover:not(:disabled){border-color:var(--bn-accent)}.bn-option-values button.is-selected{border:2px solid var(--bn-accent);background:${accent}10;color:var(--bn-accent)}.bn-option-values button:disabled{opacity:.35;cursor:not-allowed}.bn-stock-note{font-size:11px;color:#397453;display:flex;align-items:center;gap:5px;margin-top:8px}
        .bn-purchase-row{display:flex;align-items:center;gap:12px;margin:20px 0 12px}.bn-quantity{height:46px;border:1px solid var(--bn-border);border-radius:12px;display:flex;align-items:center;overflow:hidden}.bn-quantity button{width:42px;height:100%;border:0;background:#fff;color:var(--bn-ink);display:grid;place-items:center;cursor:pointer}.bn-quantity button:hover{background:#f5f3ef}.bn-quantity span{width:42px;text-align:center;font-size:14px;font-weight:800}.bn-quantity-label{font-size:12px;font-weight:700;color:var(--bn-muted)}.bn-add-button{width:100%;height:56px;border:0;border-radius:13px;background:var(--bn-accent);color:#fff;display:flex;align-items:center;justify-content:center;gap:9px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 12px 24px ${accent}2d}.bn-add-button:hover{filter:brightness(.95);transform:translateY(-1px)}.bn-add-button b{font-weight:700}.bn-unavailable{padding:15px;border-radius:12px;background:#f2f1ee;color:var(--bn-muted);font-size:13px;text-align:center;font-weight:700}.bn-added-row{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding:10px 12px;background:#edf7f0;border-radius:10px;font-size:11px}.bn-added-row span{display:flex;align-items:center;gap:5px;color:#34734d;font-weight:700}.bn-added-row a{display:flex;align-items:center;gap:4px;color:var(--bn-accent);font-weight:800;text-decoration:none}.bn-assurances{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-top:21px;padding-top:18px;border-top:1px solid var(--bn-border)}.bn-assurances>div{display:flex;gap:7px;color:var(--bn-accent)}.bn-assurances span{display:grid;gap:2px}.bn-assurances b{font-size:10px;color:var(--bn-ink)}.bn-assurances small{font-size:9px;color:var(--bn-muted);line-height:1.3}
        .bn-information-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(260px,.65fr);gap:28px;margin-top:32px}.bn-detail-panel,.bn-love-card{background:#fff;border:1px solid var(--bn-border);border-radius:20px}.bn-tabs{display:flex;gap:28px;padding:0 24px;border-bottom:1px solid var(--bn-border)}.bn-tabs button{position:relative;border:0;background:none;padding:18px 2px 15px;color:var(--bn-muted);font-size:12px;font-weight:700;cursor:pointer}.bn-tabs button.is-active{color:var(--bn-ink)}.bn-tabs button.is-active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--bn-accent)}.bn-tab-content{padding:26px 28px;min-height:180px}.bn-tab-content h2,.bn-love-card h2{font-family:Georgia,"Times New Roman",serif;font-size:24px;margin:0 0 11px}.bn-tab-content p{font-size:13px;line-height:1.85;color:var(--bn-muted);max-width:760px;margin:0}.bn-detail-list{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.bn-detail-list div{background:#faf9f6;border:1px solid var(--bn-border);padding:13px;border-radius:11px;display:grid;gap:4px}.bn-detail-list span{font-size:10px;color:var(--bn-muted)}.bn-detail-list b{font-size:12px}.bn-empty-detail{min-height:100px;display:flex;align-items:center;gap:10px;color:var(--bn-muted)}.bn-empty-detail a{display:inline-flex;align-items:center;gap:5px;color:var(--bn-accent);font-weight:800;text-decoration:none}.bn-love-card{padding:26px}.bn-love-card h2{font-size:22px;padding-bottom:16px;border-bottom:1px solid var(--bn-border)}.bn-love-card>div{display:flex;align-items:flex-start;gap:10px;padding:11px 0;font-size:12px;color:var(--bn-muted)}.bn-love-card svg{color:var(--bn-accent);flex:0 0 auto;margin-top:1px}
        @media(max-width:1000px){.bn-product-layout{grid-template-columns:1fr}.bn-product-card{position:static}.bn-main-image{height:65vw;max-height:620px}.bn-information-grid{grid-template-columns:1fr}.bn-love-card{display:grid;grid-template-columns:repeat(2,1fr);gap:0 16px}.bn-love-card h2{grid-column:1/-1}.bn-product-nav{display:none}}
        @media(max-width:680px){.bn-product-header{height:66px;padding:0 16px;gap:12px}.bn-product-brand{min-width:0}.bn-product-brand strong{font-size:13px}.bn-product-brand small{display:none}.bn-product-brand-mark{width:36px;height:36px}.bn-cart-button span{display:none}.bn-product-main{padding:18px 14px 45px}.bn-breadcrumbs{font-size:10px}.bn-back-link{display:none}.bn-product-layout{gap:18px}.bn-main-image{min-height:310px;height:82vw;border-radius:18px}.bn-thumbnails{grid-template-columns:repeat(4,1fr)}.bn-thumbnails button{height:70px}.bn-product-card{padding:23px 18px;border-radius:18px}.bn-product-card h1{font-size:32px}.bn-price-row strong{font-size:25px}.bn-feature-strip{grid-template-columns:1fr;gap:10px}.bn-feature-strip>div{align-items:center}.bn-assurances{grid-template-columns:1fr}.bn-detail-list{grid-template-columns:1fr}.bn-tabs{gap:17px;overflow:auto}.bn-tabs button{white-space:nowrap}.bn-tab-content{padding:22px 18px}.bn-love-card{display:block}.bn-love-card>div{padding:9px 0}}
      `}</style>
    </div>
  );
}
