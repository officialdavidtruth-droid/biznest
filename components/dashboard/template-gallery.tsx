"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { getTemplateTheme } from "@/lib/template-themes";

export type TemplateOption = { id: string; name: string; category: string };

export function TemplateGallery({
  templates,
  selectedId,
  onSelect,
}: {
  templates: TemplateOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(templates.map((t) => t.category));
    return [...set].sort();
  }, [templates]);

  const filtered = templates.filter((t) => {
    const q = query.toLowerCase();
    const matchesQuery = !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    const matchesCategory = !activeCategory || t.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  // No rows at all — this is a data problem (empty StoreTemplate table),
  // not a search problem. Say so plainly instead of implying "try another search."
  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium">No templates are set up yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          The template catalog is empty on this deployment. Run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run db:seed</code>{" "}
          against your database, then refresh this page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search templates (e.g. Restaurant, Salon, Portfolio)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm transition focus:border-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} of {templates.length} templates</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            activeCategory === null ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c === activeCategory ? null : c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeCategory === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => {
          const theme = getTemplateTheme(t.category, t.name);
          const isSelected = selectedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`group overflow-hidden rounded-xl border text-left transition-all ${
                isSelected ? "border-primary ring-2 ring-primary/50" : "border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
              }`}
            >
              {/* Mini mockup preview — the store's actual hero, scaled down */}
              <div
                className="relative flex h-36 flex-col justify-between overflow-hidden p-4"
                style={{ background: theme.bg, color: theme.ink, fontFamily: theme.font }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ color: theme.accent, border: `1px solid ${theme.accent}` }}
                  >
                    {theme.eyebrow}
                  </span>
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
                      <Check className="h-3 w-3" style={{ color: theme.bg }} />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight" style={{ fontFamily: theme.font }}>
                    {theme.headline}
                  </p>
                  <span
                    className="mt-2 inline-block rounded px-2.5 py-1 text-[10px] font-bold"
                    style={{ background: theme.accent, color: theme.bg, borderRadius: theme.radius }}
                  >
                    {theme.cta}
                  </span>
                </div>
                {/* faux product chips to hint at layout density */}
                <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-20" style={{ background: theme.accent }} />
              </div>

              <div className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.category}</p>
                </div>
                {isSelected && <span className="shrink-0 text-[10px] font-semibold text-primary">In use</span>}
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm font-medium">No templates match your search</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different keyword{activeCategory ? ", or clear the category filter" : ""}.
            </p>
            {(query || activeCategory) && (
              <button
                onClick={() => { setQuery(""); setActiveCategory(null); }}
                className="mt-3 text-xs font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
