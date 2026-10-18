"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2, Eye } from "lucide-react";
import { saveStorePageBlocks } from "@/lib/actions/pages";
import { FileUploadField } from "@/components/forms/file-upload-field";
import { BLOCK_LIBRARY, createBlock, type PageBlock, type PageBlockType } from "@/lib/page-blocks";

const input = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground";

/**
 * WordPress-style block builder for a custom store page. Shown to the store
 * owner/staff when a page is empty (or with ?edit=1). Each block is edited
 * with its own controls; Save writes the whole block list.
 */
export function PageBlockEditor({
  slug,
  pageSlug,
  title,
  initialBlocks,
  isPublished,
}: {
  slug: string;
  pageSlug: string;
  title: string;
  initialBlocks: PageBlock[];
  isPublished: boolean;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update(next: PageBlock[]) { setBlocks(next); setDirty(true); }
  function patch(id: string, p: Partial<PageBlock>) {
    update(blocks.map((b) => (b.id === id ? ({ ...b, ...p } as PageBlock) : b)));
  }
  function add(type: PageBlockType) { update([...blocks, createBlock(type)]); }
  function remove(id: string) { update(blocks.filter((b) => b.id !== id)); }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await saveStorePageBlocks(slug, pageSlug, blocks);
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Page saved");
      setDirty(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong saving the page. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const palette = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {BLOCK_LIBRARY.map((b) => (
        <button
          key={b.type}
          type="button"
          onClick={() => add(b.type)}
          className="rounded-lg border border-border bg-background px-3 py-3 text-left text-foreground hover:border-primary hover:bg-muted"
        >
          <span className="block text-sm font-medium">{b.label}</span>
          <span className="block text-xs text-muted-foreground">{b.hint}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-foreground">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-xs text-muted-foreground">
            Page builder · only you can see this editor{!isPublished && " · this page is unpublished"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/store/${slug}/${pageSlug}`} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
            <Eye className="h-3.5 w-3.5" /> View page
          </Link>
          <button type="button" onClick={save} disabled={saving || !dirty} className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
            {saving ? "Saving…" : "Save page"}
          </button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <h2 className="text-lg font-semibold">This page is empty — start building</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Pick a block to add. You can reorder, edit and delete blocks any time.</p>
          {palette}
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((b, i) => (
            <div key={b.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {BLOCK_LIBRARY.find((x) => x.type === b.type)?.label}
                </span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="Move down" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => remove(b.id)} aria-label="Delete block" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
              <BlockFields block={b} onChange={(p) => patch(b.id, p)} />
            </div>
          ))}

          <details className="rounded-lg border border-dashed border-border p-3">
            <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Plus className="h-4 w-4" /> Add block
            </summary>
            <div className="mt-3">{palette}</div>
          </details>
        </div>
      )}
    </div>
  );
}

function BlockFields({ block: b, onChange }: { block: PageBlock; onChange: (p: Partial<PageBlock>) => void }) {
  switch (b.type) {
    case "heading":
      return (
        <div className="flex gap-2">
          <input className={input} value={b.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Heading text" maxLength={200} />
          <select className="rounded-md border border-input bg-background px-2 text-sm" value={b.level} onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 })}>
            <option value={1}>Large</option><option value={2}>Medium</option><option value={3}>Small</option>
          </select>
        </div>
      );
    case "text":
      return <textarea className={input} rows={5} value={b.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Write something…" maxLength={5000} />;
    case "image":
      return (
        <div className="space-y-2">
          <FileUploadField label="Image" value={b.url} onChange={(url) => onChange({ url })} />
          <input className={input} value={b.alt} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Describe the image (for accessibility)" maxLength={200} />
          <input className={input} value={b.caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Caption (optional)" maxLength={300} />
        </div>
      );
    case "button":
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={input} value={b.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Button label" maxLength={60} />
          <input className={input} value={b.href} onChange={(e) => onChange({ href: e.target.value })} placeholder="/catalog or https://…" />
        </div>
      );
    case "quote":
      return (
        <div className="space-y-2">
          <textarea className={input} rows={2} value={b.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Quote" maxLength={600} />
          <input className={input} value={b.author} onChange={(e) => onChange({ author: e.target.value })} placeholder="Who said it (optional)" maxLength={100} />
        </div>
      );
    case "list":
      return (
        <div className="space-y-1.5">
          {b.items.map((item, n) => (
            <div key={n} className="flex gap-1.5">
              <input className={input} value={item} onChange={(e) => onChange({ items: b.items.map((x, k) => (k === n ? e.target.value : x)) })} placeholder={`Item ${n + 1}`} maxLength={300} />
              <button type="button" aria-label="Remove item" onClick={() => onChange({ items: b.items.length > 1 ? b.items.filter((_, k) => k !== n) : [""] })} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {b.items.length < 30 && (
            <button type="button" onClick={() => onChange({ items: [...b.items, ""] })} className="text-xs font-medium text-primary">+ Add item</button>
          )}
        </div>
      );
    case "divider":
      return <p className="text-xs text-muted-foreground">A horizontal line between sections.</p>;
    case "spacer":
      return (
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={b.size} onChange={(e) => onChange({ size: e.target.value as "sm" | "md" | "lg" })}>
          <option value="sm">Small space</option><option value="md">Medium space</option><option value="lg">Large space</option>
        </select>
      );
    case "products":
      return (
        <div className="space-y-2">
          <input className={input} value={b.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Section title (e.g. Our Menu)" maxLength={120} />
          <div className="flex gap-2">
            <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={b.kind} onChange={(e) => onChange({ kind: e.target.value as "all" | "products" | "services" })}>
              <option value="all">Products &amp; services</option><option value="products">Products only</option><option value="services">Services only</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Show up to
              <input type="number" min={1} max={24} className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" value={b.limit} onChange={(e) => onChange({ limit: Math.min(24, Math.max(1, Number(e.target.value) || 1)) })} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Shows live items from your catalog.</p>
        </div>
      );
    case "contact":
      return (
        <div className="space-y-2">
          <input className={input} value={b.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Title" maxLength={120} />
          <p className="text-xs text-muted-foreground">Shows the phone, email and address from your store settings.</p>
        </div>
      );
  }
}
