"use client";

import { useState } from "react";
import { updateSectionOverrides } from "@/lib/actions/sections";
import { toast } from "sonner";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Section } from "@/lib/template-themes";

const LABELS: Record<Section, string> = {
  hero: "Hero",
  catalog: "Catalog (products/services)",
  about: "About",
  stats: "Stats bar (listings, rating, orders)",
  features: "Why choose us (feature grid)",
  testimonials: "Testimonials",
  newsletter: "Email signup",
  contact: "Contact",
};

export function SectionEditor({
  slug,
  initialOrder,
  initialHidden,
}: {
  slug: string;
  initialOrder: Section[];
  initialHidden: Section[];
}) {
  const [order, setOrder] = useState<Section[]>(initialOrder);
  const [hidden, setHidden] = useState<Set<Section>>(new Set(initialHidden));
  const [isSaving, setIsSaving] = useState(false);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 1 || target >= order.length) return; // never move past hero at index 0
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function toggleHidden(s: Section) {
    const next = new Set(hidden);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setHidden(next);
  }

  async function save() {
    setIsSaving(true);
    const formData = new FormData();
    for (const s of order) formData.append("order", s);
    for (const s of hidden) formData.append(`hidden-${s}`, "on");
    const result = await updateSectionOverrides(slug, formData);
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Sections updated");
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-1 text-sm font-medium">Arrange sections</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Reorder, hide, or add sections. A section still won't show on the live storefront if it has
        nothing real behind it yet (e.g. Testimonials with zero reviews) — this controls
        arrangement, not fabricated content.
      </p>
      <div className="space-y-1.5">
        {order.map((s, i) => (
          <div key={s} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className={hidden.has(s) ? "text-muted-foreground line-through" : ""}>{LABELS[s]}</span>
            <div className="flex items-center gap-2">
              {s !== "hero" && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={hidden.has(s)} onChange={() => toggleHidden(s)} />
                  Hide
                </label>
              )}
              <button type="button" onClick={() => move(i, -1)} disabled={i <= 1} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === 0 || i === order.length - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={isSaving} className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
        {isSaving ? "Saving…" : "Save section layout"}
      </button>
    </div>
  );
}
