"use client";

import type { ComponentType } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { BLOCK_LABELS, MAX_BLOCKS, newBlock, type BlockType, type PageBlock } from "@/lib/storefront/page-blocks";

type ImageFieldProps = { label: string; value: string; onChange: (v: string) => void };

const input = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";
const small = "mb-1 block text-[11px] text-muted-foreground";
const ADDABLE: BlockType[] = ["heading", "text", "image", "button", "faq", "gallery", "divider"];

/**
 * Block editor for a page's content. The parent owns the blocks and the Save button; ImageField is passed in so
 * image uploads use the same control as the rest of the customizer.
 */
export function PageBlockEditor({ blocks, onChange, ImageField }: { blocks: PageBlock[]; onChange: (next: PageBlock[]) => void; ImageField: ComponentType<ImageFieldProps> }) {
  const patch = (id: string, change: Partial<PageBlock>) => onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...change } as PageBlock) : b)));
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {blocks.length === 0 && <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No content yet. Add a block below.</p>}

      {blocks.map((b, i) => (
        <div key={b.id} className="rounded-md border border-border bg-muted/20 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{BLOCK_LABELS[b.type]}</span>
            <span className="flex items-center gap-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} title="Move down" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => remove(b.id)} title="Remove block" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </span>
          </div>

          {b.type === "heading" && (
            <div className="space-y-2">
              <input className={input} maxLength={160} value={b.text} placeholder="Heading" onChange={(e) => patch(b.id, { text: e.target.value })} />
              <select className={input} value={b.level} onChange={(e) => patch(b.id, { level: e.target.value === "3" ? 3 : 2 })}>
                <option value={2}>Large heading</option>
                <option value={3}>Smaller heading</option>
              </select>
            </div>
          )}

          {b.type === "text" && (
            <textarea className={`${input} resize-y`} rows={5} maxLength={5000} value={b.text} placeholder="Write your text. A blank line starts a new paragraph." onChange={(e) => patch(b.id, { text: e.target.value })} />
          )}

          {b.type === "image" && (
            <div className="space-y-2">
              <ImageField label="Image" value={b.url} onChange={(v) => patch(b.id, { url: v })} />
              <label className="block"><span className={small}>Describe the image (for screen readers)</span><input className={input} maxLength={200} value={b.alt} onChange={(e) => patch(b.id, { alt: e.target.value })} /></label>
              <label className="block"><span className={small}>Caption (optional)</span><input className={input} maxLength={300} value={b.caption} onChange={(e) => patch(b.id, { caption: e.target.value })} /></label>
            </div>
          )}

          {b.type === "button" && (
            <div className="space-y-2">
              <label className="block"><span className={small}>Button text</span><input className={input} maxLength={60} value={b.label} placeholder="Shop now" onChange={(e) => patch(b.id, { label: e.target.value })} /></label>
              <label className="block"><span className={small}>Link (e.g. /catalog, /contact, https://…, tel:+234…)</span><input className={input} maxLength={2000} value={b.href} placeholder="/catalog" onChange={(e) => patch(b.id, { href: e.target.value })} /></label>
            </div>
          )}

          {b.type === "faq" && (
            <div className="space-y-2">
              {b.items.map((it, n) => (
                <div key={n} className="space-y-1.5 rounded border border-border bg-background p-2">
                  <div className="flex items-center gap-1.5">
                    <input className={input} maxLength={300} value={it.q} placeholder="Question" onChange={(e) => patch(b.id, { items: b.items.map((x, k) => (k === n ? { ...x, q: e.target.value } : x)) })} />
                    <button type="button" title="Remove question" onClick={() => patch(b.id, { items: b.items.filter((_, k) => k !== n) })} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <textarea className={`${input} resize-y`} rows={3} maxLength={2000} value={it.a} placeholder="Answer" onChange={(e) => patch(b.id, { items: b.items.map((x, k) => (k === n ? { ...x, a: e.target.value } : x)) })} />
                </div>
              ))}
              {b.items.length < 30 && <button type="button" onClick={() => patch(b.id, { items: [...b.items, { q: "", a: "" }] })} className="text-xs font-medium text-muted-foreground underline hover:text-foreground">Add a question</button>}
            </div>
          )}

          {b.type === "gallery" && (
            <div className="space-y-2">
              {b.images.map((im, n) => (
                <div key={n} className="space-y-1.5 rounded border border-border bg-background p-2">
                  <ImageField label={`Photo ${n + 1}`} value={im.url} onChange={(v) => (v ? patch(b.id, { images: b.images.map((x, k) => (k === n ? { ...x, url: v } : x)) }) : patch(b.id, { images: b.images.filter((_, k) => k !== n) }))} />
                  <input className={input} maxLength={200} value={im.caption} placeholder="Caption (optional)" onChange={(e) => patch(b.id, { images: b.images.map((x, k) => (k === n ? { ...x, caption: e.target.value } : x)) })} />
                </div>
              ))}
              {b.images.length < 24 && <button type="button" onClick={() => patch(b.id, { images: [...b.images, { url: "", caption: "" }] })} className="text-xs font-medium text-muted-foreground underline hover:text-foreground">Add a photo ({b.images.length}/24)</button>}
            </div>
          )}

          {b.type === "divider" && <p className="text-xs text-muted-foreground">A thin line between sections.</p>}
        </div>
      ))}

      {blocks.length < MAX_BLOCKS && (
        <div className="rounded-md border border-dashed border-border p-2">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Plus className="h-3 w-3" /> Add a block</p>
          <div className="flex flex-wrap gap-1.5">
            {ADDABLE.map((t) => (
              <button key={t} type="button" onClick={() => onChange([...blocks, newBlock(t)])} className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted">{BLOCK_LABELS[t]}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
