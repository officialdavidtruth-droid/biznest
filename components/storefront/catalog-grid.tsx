"use client";

import { useMemo, useState } from "react";

export type GridItem = {
  id: string; kind: "product" | "service"; name: string;
  price: number; currency: string; image: string | null; categoryName?: string;
};

type Sort = "featured" | "price-asc" | "price-desc" | "name";

/**
 * Client-side sort/filter bar for category and catalog pages. Kept as a
 * small client island rather than server-side query params, since the
 * item lists here are already small per store (dozens, not thousands) and
 * this avoids a full page reload on every sort change.
 */
export function CatalogGrid({
  items, slug, accent, ink, radius,
}: {
  items: GridItem[]; slug: string; accent: string; ink: string; radius: string;
}) {
  const [sort, setSort] = useState<Sort>("featured");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const highestPrice = useMemo(() => Math.max(0, ...items.map((i) => i.price)), [items]);

  const sorted = useMemo(() => {
    let list = items;
    if (maxPrice != null) list = list.filter((i) => i.price <= maxPrice);
    const copy = [...list];
    if (sort === "price-asc") copy.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") copy.sort((a, b) => b.price - a.price);
    else if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [items, sort, maxPrice]);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 24, paddingBottom: 18, borderBottom: `1px solid ${ink}14` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, opacity: 0.6, fontWeight: 600 }}>Sort</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            style={{ background: `${ink}05`, border: `1px solid ${ink}22`, color: ink, borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }}
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </div>

        {highestPrice > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, opacity: 0.6, fontWeight: 600 }}>Max price</label>
            <input
              type="range"
              min={0}
              max={highestPrice}
              value={maxPrice ?? highestPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              style={{ accentColor: accent, width: 140 }}
            />
            <span style={{ fontSize: 12, opacity: 0.7, minWidth: 70 }}>
              {items[0]?.currency} {(maxPrice ?? highestPrice).toLocaleString()}
            </span>
          </div>
        )}

        <span style={{ fontSize: 12, opacity: 0.5, marginLeft: "auto" }}>{sorted.length} shown</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
        {sorted.map((item) => (
          <a
            key={`${item.kind}-${item.id}`}
            href={`/store/${slug}/${item.kind}/${item.id}`}
            style={{ display: "block", textDecoration: "none", color: "inherit", border: `1px solid ${ink}14`, borderRadius: radius, overflow: "hidden", background: `${ink}05` }}
          >
            <div style={{ aspectRatio: "1/1", background: item.image ? `url(${item.image}) center/cover` : `${ink}0d` }} />
            <div style={{ padding: 14 }}>
              {item.categoryName && <div style={{ fontSize: 10.5, opacity: 0.55, textTransform: "uppercase", marginBottom: 4 }}>{item.categoryName}</div>}
              <h4 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>{item.name}</h4>
              <span style={{ fontSize: 15, fontWeight: 800, color: accent }}>{item.currency} {item.price.toLocaleString()}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
