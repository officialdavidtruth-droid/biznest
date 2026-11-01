"use client";

import { useEffect, useRef, useState, type ComponentType, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { saveSystemSections } from "@/lib/actions/system-sections";
import { PageBlockEditor } from "@/components/dashboard/page-block-editor";
import type { CatalogOptions } from "@/lib/storefront/page-block-catalog";
import { SYSTEM_PAGE_KEYS, SYSTEM_PAGE_LABELS, type SystemPageKey, type SystemSections, type SystemSectionsMap } from "@/lib/storefront/system-sections";

type ImageFieldProps = { label: string; value: string; onChange: (v: string) => void };

/**
 * "Store pages" group at the top of Customize > Pages: Shop, Product and Cart. The page's main part is owned by the
 * platform and always shown; the owner edits the blocks above and below it. ImageField is passed in, as for the
 * page editor, so uploads use the same control as the rest of the customizer.
 */
export function SystemPagesSection({
  slug, sections, setSections, support, catalogOptions, ImageField, onSaved, onPreview, onDraft,
}: {
  slug: string;
  sections: SystemSectionsMap;
  setSections: Dispatch<SetStateAction<SystemSectionsMap>>;
  support: Record<SystemPageKey, boolean>;
  catalogOptions?: CatalogOptions;
  ImageField: ComponentType<ImageFieldProps>;
  onSaved: () => void;
  onPreview: (key: SystemPageKey) => void;
  /** Called on every edit with the unsaved blocks so the preview can show them live. */
  onDraft?: (key: SystemPageKey, draft: SystemSections) => void;
}) {
  const [open, setOpen] = useState<SystemPageKey | null>(null);

  return (
    <div className="mb-5">
      <p className="mb-2 text-xs text-muted-foreground">
        Store pages. The shop, product and cart are drawn by BizNest and always work. Add your own blocks above or below them.
      </p>
      <div className="space-y-1.5">
        {SYSTEM_PAGE_KEYS.map((key) => {
          const count = sections[key].above.length + sections[key].below.length;
          return (
            <div key={key} className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => { const next = open === key ? null : key; setOpen(next); if (next && support[key]) onPreview(key); }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted"
              >
                <span className="flex items-center gap-2 truncate">
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate font-medium">{SYSTEM_PAGE_LABELS[key].title}</span>
                  {count > 0 && <span className="shrink-0 text-[10px] text-muted-foreground">{count} block{count === 1 ? "" : "s"}</span>}
                </span>
                {open === key ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </button>
              {open === key && (
                support[key] ? (
                  <SystemPageEditor
                    key={key}
                    slug={slug}
                    pageKey={key}
                    initial={sections[key]}
                    catalogOptions={catalogOptions}
                    ImageField={ImageField}
                    onDraft={(d) => onDraft?.(key, d)}
                    onSaved={(next) => { setSections((prev) => ({ ...prev, [key]: next })); onSaved(); }}
                  />
                ) : (
                  <p className="border-t border-border p-3 text-xs text-muted-foreground">
                    Your template draws its own {SYSTEM_PAGE_LABELS[key].title.toLowerCase()}, so blocks can&apos;t be added to it. Choose a standard template to use this.
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SystemPageEditor({
  slug, pageKey, initial, catalogOptions, ImageField, onSaved, onDraft,
}: {
  slug: string; pageKey: SystemPageKey; initial: SystemSections; catalogOptions?: CatalogOptions;
  ImageField: ComponentType<ImageFieldProps>; onSaved: (next: SystemSections) => void; onDraft: (draft: SystemSections) => void;
}) {
  const [draft, setDraft] = useState<SystemSections>(initial);
  const [saving, setSaving] = useState(false);
  const label = SYSTEM_PAGE_LABELS[pageKey];
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;

  // Show what is being typed in the preview straight away, without waiting for Save.
  useEffect(() => { onDraftRef.current(draft); }, [draft]);

  async function save() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("sections", JSON.stringify(draft));
      // Never leave the button on "Saving": if the server has not answered in 30 seconds, say so and let the owner retry.
      const res = await Promise.race([
        saveSystemSections(slug, pageKey, fd),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 30_000)),
      ]);
      if (!res.success) { toast.error(res.error); return; }
      // Blocks that were empty or unsafe are dropped on save; show what was actually kept.
      setDraft(res.data);
      onSaved(res.data);
      toast.success(`${label.title} saved`);
    } catch {
      toast.error("Saving is taking too long or your connection dropped. Check it and press Save again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label.hint}</p>
      <div>
        <p className="mb-1 text-xs font-medium">Above {label.main}</p>
        <PageBlockEditor blocks={draft.above} onChange={(above) => setDraft((d) => ({ ...d, above }))} ImageField={ImageField} catalog={catalogOptions} />
      </div>
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" aria-hidden /> {label.main.charAt(0).toUpperCase() + label.main.slice(1)} (always shown)
      </div>
      <div>
        <p className="mb-1 text-xs font-medium">Below {label.main}</p>
        <PageBlockEditor blocks={draft.below} onChange={(below) => setDraft((d) => ({ ...d, below }))} ImageField={ImageField} catalog={catalogOptions} />
      </div>
      <button type="button" onClick={save} disabled={saving} className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
