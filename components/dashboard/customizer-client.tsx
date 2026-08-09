"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  X, Monitor, Tablet, Smartphone, LayoutTemplate, Rows3, ChevronRight,
  ArrowUp, ArrowDown, RotateCw, MousePointerClick,
} from "lucide-react";
import { updateSectionOverrides } from "@/lib/actions/sections";
import type { Section } from "@/lib/template-themes";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

const SECTION_LABELS: Record<Section, string> = {
  hero: "Hero",
  catalog: "Catalog (products/services)",
  about: "About",
  stats: "Stats bar (listings, rating, orders)",
  features: "Why choose us (feature grid)",
  categories: "Shop by category",
  deal: "Deal banner",
  testimonials: "Testimonials",
  newsletter: "Email signup",
  contact: "Contact",
};

type Panel = "sections" | null;

/**
 * A WordPress-Customizer-style editor for a store's already-chosen template:
 * a narrow control panel on the left ("Sections & Layout" — the one thing
 * this page shapes now), a live preview of the actual storefront on the
 * right that updates after every save, and device-width toggles across the
 * top. Picking *which* template to use lives on its own page
 * (/admin/templates, see templates-page-client.tsx) — this component only
 * shows the current one, read-only, with a link to go change it there.
 */
export function CustomizerClient({
  slug,
  storeName,
  currentTemplateName,
  initialOrder,
  initialHidden,
}: {
  slug: string;
  storeName: string;
  currentTemplateName: string | null;
  initialOrder: Section[];
  initialHidden: Section[];
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [order, setOrder] = useState<Section[]>(initialOrder);
  const [hidden, setHidden] = useState<Set<Section>>(new Set(initialHidden));
  const [isSaving, setIsSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = useMemo(() => `/store/${slug}?preview=1`, [slug]);

  function refreshPreview() {
    setPreviewKey((k) => k + 1);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 1 || target >= order.length) return;
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

  async function saveSections() {
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
    toast.success("Layout published");
    refreshPreview();
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-muted/20">
      {/* Left control panel */}
      <div className="flex h-full w-[380px] shrink-0 flex-col border-r border-border bg-background">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link
            href={`/store/${slug}/admin`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Customize</p>
            <p className="truncate text-xs text-muted-foreground">{storeName}</p>
          </div>
        </div>

        {panel === null ? (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="mb-1 flex items-center justify-between rounded-md border border-border px-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <LayoutTemplate className="h-3.5 w-3.5" /> Template
                </p>
                <p className="mt-1 truncate text-sm font-medium">{currentTemplateName ?? "None selected"}</p>
              </div>
              <Link
                href={`/store/${slug}/admin/templates`}
                className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Change
              </Link>
            </div>
            <button
              onClick={() => setPanel("sections")}
              className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <Rows3 className="h-4 w-4" /> Sections & Layout
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <Link
              href={`/store/${slug}/admin/website-editor`}
              className="mt-1 flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4" /> Edit text & images
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <button
              onClick={() => setPanel(null)}
              className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back
            </button>

            {panel === "sections" && (
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Reorder, hide, or add sections. A section still won't show live if it has nothing
                  real behind it yet (e.g. Testimonials with zero reviews).
                </p>
                <div className="space-y-1.5">
                  {order.map((s, i) => (
                    <div key={s} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className={hidden.has(s) ? "text-muted-foreground line-through" : ""}>{SECTION_LABELS[s]}</span>
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
                <button
                  onClick={saveSections}
                  disabled={isSaving}
                  className="mt-4 w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {isSaving ? "Publishing…" : "Publish layout"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: live preview */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5">
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setDevice("desktop")}
              className={`rounded px-2 py-1.5 ${device === "desktop" ? "bg-muted" : "text-muted-foreground hover:bg-muted/50"}`}
              title="Desktop"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDevice("tablet")}
              className={`rounded px-2 py-1.5 ${device === "tablet" ? "bg-muted" : "text-muted-foreground hover:bg-muted/50"}`}
              title="Tablet"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={`rounded px-2 py-1.5 ${device === "mobile" ? "bg-muted" : "text-muted-foreground hover:bg-muted/50"}`}
              title="Mobile"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={refreshPreview}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <RotateCw className="h-3.5 w-3.5" /> Refresh preview
          </button>
        </div>

        <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/40 p-6">
          <iframe
            key={previewKey}
            ref={iframeRef}
            src={previewUrl}
            className="h-full min-h-[900px] rounded-lg border border-border bg-white shadow-sm transition-[width] duration-200"
            style={{ width: DEVICE_WIDTH[device] }}
          />
        </div>
      </div>
    </div>
  );
}
