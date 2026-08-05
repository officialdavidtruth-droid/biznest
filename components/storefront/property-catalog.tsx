"use client";

import { useMemo, useState } from "react";
import { PropertyMap, type MapProperty } from "./property-map";

export type PropertyAttributes = {
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  address?: string;
  lat?: number;
  lng?: number;
  listingType?: "sale" | "rent" | "shortlet";
};

export type PropertyListing = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string | null;
  attributes: PropertyAttributes;
};

export function PropertyCatalog({ listings, theme }: {
  listings: PropertyListing[];
  theme: { bg: string; ink: string; card: string; accent: string; radius: string };
}) {
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [minBeds, setMinBeds] = useState<number | "">("");

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (maxPrice !== "" && l.price > maxPrice) return false;
      if (minBeds !== "" && (l.attributes.bedrooms ?? 0) < minBeds) return false;
      return true;
    });
  }, [listings, maxPrice, minBeds]);

  const mapPoints: MapProperty[] = filtered
    .filter((l) => typeof l.attributes.lat === "number" && typeof l.attributes.lng === "number")
    .map((l) => ({
      id: l.id,
      name: l.name,
      priceLabel: `${l.currency} ${l.price.toLocaleString()}`,
      lat: l.attributes.lat as number,
      lng: l.attributes.lng as number,
    }));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <select
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : "")}
          style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: `1px solid ${theme.ink}33`, background: theme.card, color: theme.ink }}
        >
          <option value="">Any price</option>
          <option value={5000000}>Up to ₦5,000,000</option>
          <option value={20000000}>Up to ₦20,000,000</option>
          <option value={50000000}>Up to ₦50,000,000</option>
          <option value={150000000}>Up to ₦150,000,000</option>
        </select>
        <select
          value={minBeds}
          onChange={(e) => setMinBeds(e.target.value ? Number(e.target.value) : "")}
          style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: `1px solid ${theme.ink}33`, background: theme.card, color: theme.ink }}
        >
          <option value="">Any bedrooms</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ bed</option>)}
        </select>
        <span style={{ fontSize: 12, opacity: 0.6, alignSelf: "center" }}>{filtered.length} of {listings.length} listings</span>
      </div>

      {mapPoints.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <PropertyMap properties={mapPoints} accent={theme.accent} />
        </div>
      )}

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {filtered.map((l) => (
          <div key={l.id} style={{ background: theme.card, borderRadius: theme.radius, overflow: "hidden" }}>
            <div style={{ aspectRatio: "4/3", background: `${theme.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt={l.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 22, opacity: 0.4 }}>{l.name.charAt(0)}</span>
              )}
            </div>
            <div style={{ padding: 14 }}>
              <p style={{ fontWeight: 700, fontSize: 15 }}>{l.currency} {l.price.toLocaleString()}</p>
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{l.name}</p>
              {l.attributes.address && <p style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{l.attributes.address}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                {l.attributes.bedrooms != null && <span>{l.attributes.bedrooms} bed</span>}
                {l.attributes.bathrooms != null && <span>{l.attributes.bathrooms} bath</span>}
                {l.attributes.areaSqm != null && <span>{l.attributes.areaSqm} m²</span>}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ opacity: 0.6, fontSize: 14 }}>No listings match those filters.</p>
        )}
      </div>
    </div>
  );
}
