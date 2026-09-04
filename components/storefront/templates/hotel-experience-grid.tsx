"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutGrid, UtensilsCrossed, Flower2, Briefcase, Dumbbell, CalendarDays, MapPin,
  Heart, Car, Users, ArrowRight,
} from "lucide-react";

type Theme = { bg: string; ink: string; card: string; accent: string; border?: string; muted?: string; radius: string; font: string; headlineFont: string };
export type ExperienceItem = { id: string; name: string; description: string | null; image: string | null; categoryName: string | null };

const ICON_MATCH: Array<[RegExp, React.ElementType]> = [
  [/din|culinary|food|restaurant/i, UtensilsCrossed], [/wellness|spa/i, Flower2], [/business|meeting|conference/i, Briefcase],
  [/fitness|recreation|gym/i, Dumbbell], [/event|celebrat/i, CalendarDays], [/local|tour|explore/i, MapPin],
  [/romantic|honeymoon/i, Heart], [/transfer|airport|car/i, Car], [/family/i, Users],
];
function categoryIcon(label: string): React.ElementType {
  const match = ICON_MATCH.find(([re]) => re.test(label));
  return match ? match[1] : LayoutGrid;
}

export function HotelExperienceGrid({ slug, theme, items, detailBasePath }: { slug: string; theme: Theme; items: ExperienceItem[]; detailBasePath: string }) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const ink = theme.ink;
  const accent = theme.accent;
  const border = theme.border || `${ink}1c`;
  const muted = theme.muted || `${ink}8f`;

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.categoryName).filter(Boolean))) as string[], [items]);
  const filtered = useMemo(() => (activeCategory === "all" ? items : items.filter((i) => i.categoryName === activeCategory)), [items, activeCategory]);

  if (items.length === 0) {
    return <p style={{ color: muted }}>Experiences will appear here once they're added.</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
        <button type="button" onClick={() => setActiveCategory("all")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 92, padding: "12px 10px", borderRadius: 10, border: `1px solid ${activeCategory === "all" ? accent : border}`, background: activeCategory === "all" ? accent : theme.card, color: activeCategory === "all" ? "#fff" : ink, cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>
          <LayoutGrid size={17} /> All Experiences
        </button>
        {categories.map((c) => {
          const Icon = categoryIcon(c);
          const isActive = activeCategory === c;
          return (
            <button key={c} type="button" onClick={() => setActiveCategory(c)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 92, padding: "12px 10px", borderRadius: 10, border: `1px solid ${isActive ? accent : border}`, background: isActive ? accent : theme.card, color: isActive ? "#fff" : ink, cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>
              <Icon size={17} /> {c}
            </button>
          );
        })}
      </div>

      <div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {filtered.map((item, i) => {
          const Icon = categoryIcon(item.categoryName || "");
          return (
            <div key={item.id} style={{ border: `1px solid ${border}`, borderRadius: theme.radius, overflow: "hidden", background: theme.card, display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", aspectRatio: "4/3", background: item.image ? `url(${item.image}) center/cover` : `linear-gradient(135deg, ${accent}, ${ink})` }}>
                {activeCategory === "all" && i === 0 && (
                  <span style={{ position: "absolute", top: 12, left: 12, padding: "5px 12px", borderRadius: 20, background: accent, color: "#fff", fontSize: 10.5, fontWeight: 800 }}>FEATURED</span>
                )}
              </div>
              <div style={{ padding: 18, display: "grid", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: theme.headlineFont, fontSize: 16, fontWeight: 700 }}><Icon size={16} color={accent} /> {item.name}</span>
                <p style={{ margin: 0, fontSize: 12.5, color: muted, lineHeight: 1.6, minHeight: 38 }}>{item.description || "Discover more about this experience."}</p>
                <Link href={`${detailBasePath}/${item.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: accent, textDecoration: "none", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                  Learn More <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
