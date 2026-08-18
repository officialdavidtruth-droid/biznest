"use client";

import { useState } from "react";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

/**
 * Jumia-style category strip: a horizontal, scrollable row of category
 * chips just under the header. Each top-level chip (e.g. "Fashion") opens a
 * flyout of its subcategories (Men's Clothing, Women's Shoes, Jewelry...)
 * on hover/tap, and itself links to a page showing everything in that
 * category + all its subcategories combined. "All" links to the full
 * catalog page.
 */
export function CategoryNav({
  slug,
  categories,
  accent,
  ink,
  bg = "transparent",
  border,
}: {
  slug: string;
  categories: CategoryTreeNode[];
  accent: string;
  ink: string;
  bg?: string;
  border?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (categories.length === 0) return null;

  const chipBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    borderRadius: 100,
    fontSize: 13.5,
    fontWeight: 600,
    whiteSpace: "nowrap",
    textDecoration: "none",
    border: `1px solid ${border ?? `${ink}1f`}`,
    color: ink,
    flexShrink: 0,
  };

  return (
    <nav aria-label="Browse categories" style={{ background: bg, borderBottom: border ? `1px solid ${border}` : undefined, position: "relative", zIndex: 40 }}>
      <div className="bn-category-nav" style={{ display: "flex", gap: 10, padding: "14px 28px", maxWidth: 1180, margin: "0 auto", overflowX: "auto" }}>
        <a href={`/${slug}/catalog`} style={{ ...chipBase, background: accent, color: "#fff", border: "none" }}>All</a>

        {categories.map((c) => (
          <div
            key={c.id}
            onMouseEnter={() => setOpenId(c.id)}
            onMouseLeave={() => setOpenId((cur) => (cur === c.id ? null : cur))}
            style={{ position: "relative", flexShrink: 0 }}
          >
            <a
              href={`/${slug}/category/${c.id}`}
              onClick={(e) => {
                if (c.children.length > 0 && openId !== c.id) {
                  e.preventDefault();
                  setOpenId(c.id);
                }
              }}
              style={chipBase}
            >
              {c.name}
              <span style={{ opacity: 0.55, fontSize: 12 }}>({c.count})</span>
              {c.children.length > 0 && <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>}
            </a>

            {c.children.length > 0 && openId === c.id && (
              <div
                style={{
                  position: "absolute", top: "100%", left: 0, marginTop: 6, minWidth: 210,
                  background: bg || "#fff", border: `1px solid ${border ?? `${ink}1f`}`, borderRadius: 12,
                  boxShadow: "0 18px 40px -18px rgba(0,0,0,0.35)", padding: 8, zIndex: 50,
                }}
              >
                {c.children.map((child) => (
                  <a
                    key={child.id}
                    href={`/${slug}/category/${child.id}`}
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", borderRadius: 8, fontSize: 13, color: ink, textDecoration: "none" }}
                  >
                    <span>{child.name}</span>
                    <span style={{ opacity: 0.5 }}>{child.count}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <style>{`.bn-category-nav::-webkit-scrollbar{height:0px}`}</style>
    </nav>
  );
}
