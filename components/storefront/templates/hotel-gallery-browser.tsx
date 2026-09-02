"use client";

import type React from "react";
import { useMemo, useState } from "react";
import {
  LayoutGrid, Bed, UtensilsCrossed, Dumbbell, Waves, CalendarDays, Users, Building2,
  Sofa, Flower2, Camera, ArrowLeft, Image as ImageIcon,
} from "lucide-react";
import type { GalleryAlbum } from "@/lib/actions/hospitality-content";

type Theme = { bg: string; ink: string; card: string; accent: string; border?: string; muted?: string; radius: string; font: string; headlineFont: string };

const ICON_MATCH: Array<[RegExp, React.ElementType]> = [
  [/room|suite/i, Bed], [/din|restaurant|food/i, UtensilsCrossed], [/fitness|gym/i, Dumbbell],
  [/pool|outdoor|beach/i, Waves], [/event|celebrat/i, CalendarDays], [/meeting|conference|business/i, Users],
  [/exterior|building/i, Building2], [/ambien|lounge|lobby/i, Sofa], [/wellness|spa/i, Flower2],
];
function categoryIcon(label: string): React.ElementType {
  const match = ICON_MATCH.find(([re]) => re.test(label));
  return match ? match[1] : Camera;
}

export function HotelGalleryBrowser({ slug, theme, albums, fallbackImages }: { slug: string; theme: Theme; albums: GalleryAlbum[]; fallbackImages: string[] }) {
  const [activeId, setActiveId] = useState<string>("all");
  const ink = theme.ink;
  const accent = theme.accent;
  const border = theme.border || `${ink}1c`;
  const muted = theme.muted || `${ink}8f`;

  const active = useMemo(() => albums.find((a) => a.id === activeId) || null, [albums, activeId]);

  if (albums.length === 0) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {fallbackImages.length ? fallbackImages.map((src, i) => (
          <div key={src + i} style={{ aspectRatio: i === 0 ? "16/10" : "4/3", gridColumn: i === 0 ? "1 / -1" : undefined, borderRadius: theme.radius, background: `url(${src}) center/cover` }} />
        )) : (
          <p style={{ color: muted, gridColumn: "1 / -1" }}>Gallery photos will appear here once they're added.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
        <button
          type="button"
          onClick={() => setActiveId("all")}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 84, padding: "12px 10px", borderRadius: 10, border: `1px solid ${activeId === "all" ? accent : border}`, background: activeId === "all" ? accent : theme.card, color: activeId === "all" ? "#fff" : ink, cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}
        >
          <LayoutGrid size={17} /> All
        </button>
        {albums.map((a) => {
          const Icon = categoryIcon(a.title);
          const isActive = activeId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setActiveId(a.id)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 84, padding: "12px 10px", borderRadius: 10, border: `1px solid ${isActive ? accent : border}`, background: isActive ? accent : theme.card, color: isActive ? "#fff" : ink, cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}
            >
              <Icon size={17} /> {a.title}
            </button>
          );
        })}
      </div>

      {active ? (
        <div>
          <button type="button" onClick={() => setActiveId("all")} style={{ display: "flex", alignItems: "center", gap: 6, border: 0, background: "none", color: accent, cursor: "pointer", fontSize: 12.5, fontWeight: 700, marginBottom: 16, padding: 0 }}>
            <ArrowLeft size={14} /> Back to all categories
          </button>
          <h3 style={{ fontFamily: theme.headlineFont, fontSize: 22, margin: "0 0 4px" }}>{active.title}</h3>
          {active.description && <p style={{ color: muted, fontSize: 13.5, margin: "0 0 20px" }}>{active.description}</p>}
          {active.images.length === 0 ? (
            <p style={{ color: muted }}>No photos in this category yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {active.images.map((img) => (
                <div key={img.id} style={{ position: "relative", aspectRatio: "4/3", borderRadius: theme.radius, overflow: "hidden" }}>
                  <img src={img.image} alt={img.title || active.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {(img.title || img.caption) && (
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 12px", background: "linear-gradient(0deg, rgba(0,0,0,.6), transparent)", color: "#fff", fontSize: 11.5 }}>{img.title || img.caption}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {albums.map((a) => {
            const Icon = categoryIcon(a.title);
            const cover = a.coverImage || a.images[0]?.image || null;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveId(a.id)}
                style={{ position: "relative", aspectRatio: "4/3", border: 0, padding: 0, borderRadius: theme.radius, overflow: "hidden", cursor: "pointer", background: cover ? `url(${cover}) center/cover` : `linear-gradient(135deg, ${accent}, ${ink})`, textAlign: "left" }}
              >
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(10,8,6,.75), rgba(10,8,6,.05) 55%)" }} />
                <div style={{ position: "absolute", left: 16, bottom: 14, color: "#fff" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15 }}><Icon size={16} /> {a.title}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, opacity: 0.85, marginTop: 4 }}><ImageIcon size={11} /> View Photos →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
