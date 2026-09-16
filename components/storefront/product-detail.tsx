"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { useShopAuthGate } from "@/lib/hooks/use-shop-auth-gate";
import { toast } from "sonner";

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
