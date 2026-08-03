"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export type TemplateOption = { id: string; name: string; category: string };

// Deterministic color per template so previews look distinct without needing
// real screenshot assets yet — swap for actual template thumbnails later.
const PALETTE = [
  ["#F2A93B", "#1B1030"], ["#2F9E6E", "#0F2A22"], ["#3B82F6", "#0B1730"],
  ["#EF4444", "#2B0E0E"], ["#A855F7", "#1E0B2E"], ["#14B8A6", "#07211D"],
];

function colorsFor(name: string) {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

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
  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <input
        placeholder="Search templates (e.g. Restaurant, Salon, Portfolio)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full max-w-sm rounded-md border px-3 py-2 text-sm"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((t) => {
          const [accent, ink] = colorsFor(t.name);
          const isSelected = selectedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`group overflow-hidden rounded-lg border text-left transition ${
                isSelected ? "ring-2 ring-primary" : "hover:border-primary/40"
              }`}
            >
              <div
                className="flex h-24 items-end p-3"
                style={{ background: `linear-gradient(135deg, ${accent}, ${ink})` }}
              >
                {isSelected && (
                  <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
                    <Check className="h-3.5 w-3.5" style={{ color: ink }} />
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">{t.category}</p>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No templates match "{query}".
          </p>
        )}
      </div>
    </div>
  );
}
