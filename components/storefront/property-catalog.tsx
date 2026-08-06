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
  theme: { bg: string; ink: string; card: string; accent: string; radius: string; headlineFont?: string };
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <select
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : "")}
          style={{ fontSize: 13, padding: "10px 14px", borderRadius: 8, border: `1px solid ${theme.ink}22`, background: theme.card, color: theme.ink, boxShadow: "0 1px 2px rgba(18,18,18,0.06)" }}
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
          style={{ fontSize: 13, padding: "10px 14px", borderRadius: 8, border: `1px solid ${theme.ink}22`, background: theme.card, color: theme.ink, boxShadow: "0 1px 2px rgba(18,18,18,0.06)" }}
        >
          <option value="">Any bedrooms</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ bed</option>)}
        </select>
        <span style={{ fontSize: 12, opacity: 0.6, alignSelf: "center" }}>{filtered.length} of {listings.length} listings</span>
      </div>

      {mapPoints.length > 0 && (
        <div style={{ marginBottom: 24, borderRadius: theme.radius, overflow: "hidden" }}>
          <PropertyMap properties={mapPoints} accent={theme.accent} />
        </div>
      )}

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {filtered.map((l) => (
          <div key={l.id} style={{ background: theme.card, borderRadius: theme.radius, overflow: "hidden", boxShadow: "0 1px 3px rgba(18,18,18,0.06)" }} className="transition-shadow hover:shadow-lg">
            <div style={{ aspectRatio: "4/3", background: `${theme.accent}14`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt={l.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 22, opacity: 0.4 }}>{l.name.charAt(0)}</span>
              )}
            </div>
            <div style={{ padding: 18 }}>
              <p style={{ fontFamily: theme.headlineFont, fontWeight: 700, fontSize: 16 }}>{l.currency} {l.price.toLocaleString()}</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3, opacity: 0.9 }}>{l.name}</p>
              {l.attributes.address && <p style={{ fontSize: 12, opacity: 0.6, marginTop: 3 }}>{l.attributes.address}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 12, opacity: 0.75 }}>
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
