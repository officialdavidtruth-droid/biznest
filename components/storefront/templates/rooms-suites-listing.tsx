"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Users, Search, Heart, Maximize2, BedDouble } from "lucide-react";
import { formatMoney } from "@/lib/storefront/hero-media";

export type ListingItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image: string | null;
  categoryName: string | null;
  /** Free-form facets pulled from Service.attributes, e.g. { maxGuests, roomSize, bedType, wifi, view, breakfast } */
  attributes: Record<string, unknown> | null;
};

type Theme = {
  bg: string;
  ink: string;
  card: string;
  accent: string;
  border?: string;
  muted?: string;
  radius: string;
  font: string;
  headlineFont: string;
};

type Props = {
  slug: string;
  theme: Theme;
  items: ListingItem[];
  /** e.g. "Rooms & Suites" for a hotel, "Units" for short-let apartments, "Bays" for a car wash, "Spaces" for a venue. */
  itemLabelPlural?: string;
  itemLabelSingular?: string;
  /** e.g. "night" for hotel stays, "day" for rentals, "session" for services. */
  rateUnit?: string;
  /** Base path for the room/unit detail page, e.g. `/store/${slug}/room`. */
  detailBasePath: string;
  /** Base path for the booking flow, e.g. `/store/${slug}/room`. `/:id/book` is appended. */
  bookBasePath: string;
};

function attr(item: ListingItem, key: string): string {
  const v = item.attributes?.[key];
  return v === undefined || v === null || v === "" ? "" : String(v);
}

export function RoomsSuitesListing({ slug, theme, items, itemLabelPlural = "Rooms & Suites", itemLabelSingular = "Room", rateUnit = "night", detailBasePath, bookBasePath }: Props) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [amenityFilter, setAmenityFilter] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<"popular" | "price-asc" | "price-desc">("popular");

  const ink = theme.ink;
  const accent = theme.accent;
  const border = theme.border || `${ink}1c`;
  const muted = theme.muted || `${ink}8f`;

  const types = useMemo(() => Array.from(new Set(items.map((i) => i.categoryName || itemLabelSingular).filter(Boolean))), [items, itemLabelSingular]);
  const amenityKeys = ["wifi", "view", "breakfast"] as const;
  const availableAmenities = useMemo(
    () => amenityKeys.filter((k) => items.some((i) => attr(i, k))),
    [items]
  );
  const priceCeiling = useMemo(() => Math.max(1, ...items.map((i) => Number(i.price) || 0)), [items]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => {
      if (typeFilter.length && !typeFilter.includes(i.categoryName || itemLabelSingular)) return false;
      if (maxPrice != null && Number(i.price) > maxPrice) return false;
      if (amenityFilter.length && !amenityFilter.every((k) => attr(i, k))) return false;
      const cap = Number(attr(i, "maxGuests") || 0);
      if (guests && cap && cap < guests) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    return list;
  }, [items, typeFilter, maxPrice, amenityFilter, guests, sort, itemLabelSingular]);

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function clearAll() {
    setTypeFilter([]);
    setAmenityFilter([]);
    setMaxPrice(null);
  }

  function bookHref(item: ListingItem) {
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", String(guests));
    const qs = params.toString();
    return `${bookBasePath}/${item.id}/book${qs ? `?${qs}` : ""}`;
  }

  const inputStyle: React.CSSProperties = { width: "100%", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, background: theme.bg, color: ink, fontFamily: theme.font };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: muted, marginBottom: 6 };

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: theme.bg }}>
      {/* Search bar */}
      <div style={{ maxWidth: 1240, margin: "-46px auto 0", padding: "0 20px", position: "relative", zIndex: 5 }}>
        <div style={{ background: theme.card, border: `1px solid ${border}`, borderRadius: theme.radius, padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 14, alignItems: "end", boxShadow: "0 20px 44px rgba(0,0,0,.10)" }}>
          <div>
            <span style={labelStyle}><Calendar size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Check In</span>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}><Calendar size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Check Out</span>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}><Users size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Guests</span>
            <input type="number" min={1} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} style={inputStyle} />
          </div>
          <button type="button" onClick={() => document.getElementById("bn-listing-grid")?.scrollIntoView({ behavior: "smooth" })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: 0, borderRadius: 10, padding: "12px 22px", background: accent, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            <Search size={15} /> Search {itemLabelPlural}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "50px 20px 100px", display: "grid", gridTemplateColumns: "260px 1fr", gap: 32, alignItems: "start" }}>
        {/* Filters sidebar */}
        <aside style={{ position: "sticky", top: 24, display: "grid", gap: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontFamily: theme.headlineFont, fontSize: 17 }}>Filter {itemLabelPlural}</strong>
            <button type="button" onClick={clearAll} style={{ border: 0, background: "none", color: accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Clear All</button>
          </div>

          {types.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>{itemLabelSingular} Type</div>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: 13, cursor: "pointer" }}>
                  <span><input type="checkbox" checked={typeFilter.length === 0} onChange={() => setTypeFilter([])} style={{ marginRight: 8 }} />All {itemLabelPlural}</span>
                  <span style={{ color: muted }}>({items.length})</span>
                </label>
                {types.map((t) => (
                  <label key={t} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, cursor: "pointer" }}>
                    <span><input type="checkbox" checked={typeFilter.includes(t)} onChange={() => toggle(typeFilter, t, setTypeFilter)} style={{ marginRight: 8 }} />{t}</span>
                    <span style={{ color: muted }}>({items.filter((i) => (i.categoryName || itemLabelSingular) === t).length})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Price Range {rateUnit ? `(per ${rateUnit})` : ""}</div>
            <input type="range" min={0} max={priceCeiling} step={Math.max(1, Math.round(priceCeiling / 100))} value={maxPrice ?? priceCeiling} onChange={(e) => setMaxPrice(Number(e.target.value))} style={{ width: "100%", accentColor: accent }} />
            <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Up to {formatMoney(maxPrice ?? priceCeiling, items[0]?.currency || "NGN")}</div>
          </div>

          {availableAmenities.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Amenities</div>
              <div style={{ display: "grid", gap: 8 }}>
                {availableAmenities.map((k) => (
                  <label key={k} style={{ display: "flex", alignItems: "center", fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>
                    <input type="checkbox" checked={amenityFilter.includes(k)} onChange={() => toggle(amenityFilter, k, setAmenityFilter)} style={{ marginRight: 8 }} />{k === "wifi" ? "Free WiFi" : k}
                  </label>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Grid */}
        <div id="bn-listing-grid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
            <strong style={{ fontFamily: theme.headlineFont, fontSize: 20 }}>{filtered.length} {itemLabelPlural}</strong>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, background: theme.card, color: ink }}>
              <option value="popular">Most Popular</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div style={{ border: `1px dashed ${border}`, borderRadius: theme.radius, padding: 40, textAlign: "center", color: muted, fontSize: 14 }}>
              No {itemLabelPlural.toLowerCase()} match those filters right now.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
              {filtered.map((item) => {
                const guestsCap = attr(item, "maxGuests");
                const bed = attr(item, "bedType");
                const size = attr(item, "roomSize");
                return (
                  <div key={item.id} style={{ background: theme.card, border: `1px solid ${border}`, borderRadius: theme.radius, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ aspectRatio: "4/3", background: item.image ? `url(${item.image}) center/cover` : `linear-gradient(135deg, ${accent}, ${ink})` }} />
                      <button type="button" aria-label="Save" style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", border: 0, background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                        <Heart size={15} color={ink} />
                      </button>
                    </div>
                    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                      <strong style={{ fontFamily: theme.headlineFont, fontSize: 18 }}>{item.name}</strong>
                      {item.description && <p style={{ margin: 0, fontSize: 12.5, color: muted, lineHeight: 1.55 }}>{item.description}</p>}
                      <div style={{ display: "flex", gap: 14, fontSize: 12, color: muted, flexWrap: "wrap", marginTop: 2 }}>
                        {guestsCap && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users size={13} />{guestsCap} Guests</span>}
                        {bed && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><BedDouble size={13} />{bed}</span>}
                        {size && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Maximize2 size={13} />{size} m²</span>}
                      </div>
                      <div style={{ marginTop: "auto", paddingTop: 10 }}>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(Number(item.price), item.currency)} <span style={{ fontSize: 11.5, fontWeight: 600, color: muted }}>/ {rateUnit}</span></div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <Link href={`${detailBasePath}/${item.id}`} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 8, border: `1px solid ${border}`, color: ink, textDecoration: "none", fontSize: 12.5, fontWeight: 700 }}>Details</Link>
                          <Link href={bookHref(item)} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 8, border: 0, background: accent, color: "#fff", textDecoration: "none", fontSize: 12.5, fontWeight: 800 }}>Book Now</Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
