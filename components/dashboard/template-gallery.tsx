"use client";

import { useMemo, useState } from "react";
import { Check, Lock, Search, Eye } from "lucide-react";
import type { TemplateTheme } from "@/lib/template-themes";
import { DEMO_STORES } from "@/lib/demo-stores";
import { storePublicUrl } from "@/lib/utils/store-url";
import { TemplateCover } from "@/components/storefront/template-cover";

// Real, permanent live-demo stores exist for a subset of templates (see
// lib/demo-stores.ts). Map template name -> demo slug so the gallery can
// link straight to the actual running storefront instead of a mockup.
const DEMO_SLUG_BY_TEMPLATE = new Map(DEMO_STORES.map((d) => [d.templateName, d.slug]));

export type TemplateOption = {
  id: string;
  name: string;
  category: string;
  tierRank: number;
  previewUrl: string | null;
  config: unknown; // GeneratedTemplate JSON from the DB — validated loosely at render time
};

const TIER_LABEL: Record<number, string> = {
  1: "Free",
  2: "Entrepreneur",
  3: "Enterprise",
  4: "Business Mogul",
};

function themeFromConfig(config: unknown): TemplateTheme | null {
  const c = config as Partial<TemplateTheme> | null;
  if (!c || typeof c !== "object" || !c.bg) return null;
  return c as TemplateTheme;
}


export function TemplateGallery({
  templates,
  selectedId,
  onSelect,
  planRank,
}: {
  templates: TemplateOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  planRank: number;
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

  const unlockedCount = templates.filter((t) => t.tierRank <= planRank).length;

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
        <p className="text-xs text-muted-foreground">
          {unlockedCount} of {templates.length} templates unlocked on your plan
        </p>
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
          const theme = themeFromConfig(t.config);
          if (!theme) return null;
          const isSelected = selectedId === t.id;
          const isLocked = t.tierRank > planRank;
          const demoSlug = DEMO_SLUG_BY_TEMPLATE.get(t.name);

          return (
            <div
              key={t.id}
              className={`group overflow-hidden rounded-xl border text-left transition-all ${
                isLocked
                  ? "border-border opacity-60"
                  : isSelected
                  ? "border-primary ring-2 ring-primary/50"
                  : "border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
              }`}
            >
              {/* Real cover: a static facsimile of this template's actual
                  layout, colors, type, and copy — the same approach
                  WordPress uses for theme thumbnails. Built purely from the
                  template's own theme tokens, so it always renders correctly
                  for every template (not just the handful with a seeded demo
                  store) and never shows a blank/404 iframe. */}
              <button
                type="button"
                onClick={() => !isLocked && onSelect(t.id)}
                disabled={isLocked}
                className={`relative block h-40 w-full overflow-hidden bg-muted ${isLocked ? "cursor-not-allowed" : ""}`}
              >
                <TemplateCover theme={theme} />

                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
                  {isLocked ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
                      <Lock className="h-3 w-3 text-white" />
                    </span>
                  ) : isSelected ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
                      <Check className="h-3 w-3" style={{ color: theme.bg }} />
                    </span>
                  ) : null}
                </div>

                <p className="absolute bottom-2 left-3 right-3 truncate text-left text-xs font-semibold text-white drop-shadow">
                  {t.name}
                </p>
              </button>

              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.category}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {isLocked ? `Requires ${TIER_LABEL[t.tierRank] ?? "a higher plan"}` : isSelected ? "In use" : theme.heroStyle}
                  </p>
                </div>

                {/* Distinct from selecting: opens the real, fully working live
                    demo store for this template in a new tab so you can click
                    through it before committing. */}
                {demoSlug ? (
                  <a
                    href={storePublicUrl(demoSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/50 hover:text-primary"
                  >
                    <Eye className="h-3 w-3" /> Preview
                  </a>
                ) : (
                  <span className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    Preview soon
                  </span>
                )}
              </div>
            </div>
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
