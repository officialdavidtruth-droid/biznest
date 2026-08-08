import type React from "react";

export type CategoryLink = { id: string; name: string; count: number };

/**
 * Jumia-style category strip: a horizontal, scrollable row of category
 * chips just under the header, each linking to its own dedicated catalog
 * page (/store/[slug]/category/[categoryId]) rather than an anchor into a
 * single giant homepage. "All" links to the full catalog page.
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
  categories: CategoryLink[];
  accent: string;
  ink: string;
  bg?: string;
  border?: string;
}) {
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
    <nav
      aria-label="Browse categories"
      style={{
        background: bg,
        borderBottom: border ? `1px solid ${border}` : undefined,
        overflowX: "auto",
      }}
      className="bn-category-nav"
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "14px 28px",
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        <a href={`/store/${slug}/catalog`} style={{ ...chipBase, background: accent, color: "#fff", border: "none" }}>
          All
        </a>
        {categories.map((c) => (
          <a key={c.id} href={`/store/${slug}/category/${c.id}`} style={chipBase}>
            {c.name}
            <span style={{ opacity: 0.55, fontSize: 12 }}>({c.count})</span>
          </a>
        ))}
      </div>
      <style>{`.bn-category-nav::-webkit-scrollbar{height:0px}`}</style>
    </nav>
  );
}
