"use client";

import { useEffect, useRef } from "react";

export type MapProperty = {
  id: string;
  name: string;
  priceLabel: string;
  lat: number;
  lng: number;
};

/**
 * Thin wrapper around Leaflet, loaded dynamically so it never touches
 * `window` during SSR. Kept dependency-light (no react-leaflet JSX layer)
 * so it's easy to swap map providers later without restructuring callers.
 */
export function PropertyMap({ properties, accent }: { properties: MapProperty[]; accent: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || properties.length === 0) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      // Leaflet's default marker icons reference image files that don't
      // resolve correctly under Next's bundler — use a simple colored div
      // icon instead, which also matches the store's accent color.
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${accent};color:#fff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3)">●</div>`,
      });

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current).setView(
          [properties[0].lat, properties[0].lng],
          12
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      const bounds = L.latLngBounds(properties.map((p) => [p.lat, p.lng]));
      properties.forEach((p) => {
        L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${p.name}</strong><br/>${p.priceLabel}`);
      });
      if (properties.length > 1) map.fitBounds(bounds, { padding: [24, 24] });
    });

    return () => {
      cancelled = true;
    };
  }, [properties, accent]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (properties.length === 0) return null;

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} style={{ height: 320, borderRadius: 12, overflow: "hidden" }} />
    </>
  );
}
