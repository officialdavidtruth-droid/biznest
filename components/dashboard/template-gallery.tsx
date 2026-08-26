"use client";

import { useMemo, useState } from "react";
import { Check, Lock, Search, Eye, X, ShoppingBag, CalendarDays } from "lucide-react";
import type { TemplateTheme } from "@/lib/template-themes";
import { DEMO_STORES } from "@/lib/demo-stores";
import { getBusinessExperience } from "@/lib/business-experience";

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
  businessCategory,
}: {
  templates: TemplateOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  planRank: number;
  businessCategory?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "commerce" | "service">("all");
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const experience = getBusinessExperience(businessCategory);

  const categories = useMemo(() => {
    const set = new Set(templates.map((t) => t.category));
    return [...set].sort();
  }, [templates]);

  const filtered = templates.filter((t) => {
    const q = query.toLowerCase();
    const haystack = `${t.name} ${t.category}`.toLowerCase();
    const matchesQuery = !q || haystack.includes(q);
    const matchesCategory = !activeCategory || t.category === activeCategory;
    const serviceLike = /hotel|restaurant|salon|beauty|agency|clean|construction|studio|service|rental|real estate|photography/i.test(haystack);
    const matchesMode = mode === "all" || (mode === "service" ? serviceLike : !serviceLike);
    return matchesQuery && matchesCategory && matchesMode;
  });

  const scored = [...filtered].sort((a, b) => {
    const score = (t: TemplateOption) => {
      const text = `${t.name} ${t.category}`.toLowerCase();
      let n = 0;
      if (experience.mode === "service" && /studio|service|hotel|restaurant|salon|beauty|agency|rental/i.test(text)) n += 5;
      if (experience.mode === "commerce" && /market|sneaker|fashion|premium|marketplace|fresh|home|violet|heenzy/i.test(text)) n += 5;
      if (businessCategory && text.includes(businessCategory.toLowerCase().split(" ")[0])) n += 3;
      return n + (t.tierRank <= planRank ? 1 : 0);
    };
    return score(b) - score(a);
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

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-1">
        {([
          ["all", "All templates"],
          ["commerce", "Shopping"],
          ["service", "Services & booking"],
        ] as const).map(([value, label]) => (
          <button key={value} onClick={() => setMode(value)} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${mode === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {value === "commerce" ? <ShoppingBag className="mr-1 inline h-3.5 w-3.5" /> : value === "service" ? <CalendarDays className="mr-1 inline h-3.5 w-3.5" /> : null}{label}
          </button>
        ))}
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
        {scored.map((t) => {
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
              <div className="relative h-40 w-full overflow-hidden bg-muted">
                <iframe
                  title={`${t.name} live front page preview`}
                  src={`/template-preview/${encodeURIComponent(t.name)}`}
                  className="pointer-events-none absolute left-0 top-0 h-[300%] w-[300%] origin-top-left scale-[.333333] border-0 bg-white"
                  loading="lazy"
                  tabIndex={-1}
                />

                <button
                  type="button"
                  onClick={() => !isLocked && onSelect(t.id)}
                  disabled={isLocked}
                  aria-label={isLocked ? `Locked template: ${t.name}` : `Use ${t.name} template`}
                  className={`absolute inset-0 z-10 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                />

                <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-1">
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

                <p className="pointer-events-none absolute bottom-2 left-3 right-3 z-30 truncate text-left text-xs font-semibold text-white drop-shadow">
                  {t.name}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.category}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {isLocked ? `Requires ${TIER_LABEL[t.tierRank] ?? "a higher plan"}` : isSelected ? "In use" : theme.heroStyle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPreview({ name: t.name, url: demoSlug ? `/${demoSlug}` : `/template-preview/${encodeURIComponent(t.name)}` })}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  <Eye className="h-3 w-3" /> Preview
                </button>
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
      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{preview.name}</p>
                <p className="text-[11px] text-muted-foreground">Real template front page preview — rendered from the production storefront component.</p>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-md p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <iframe
              title={`${preview.name} live front page preview`}
              src={preview.url}
              className="min-h-0 flex-1 border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
