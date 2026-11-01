"use client";

import { useState, type ComponentType } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { BLOCK_LABELS, COLLECTION_LIMITS, MAX_BLOCKS, MAX_CATALOG_BLOCKS, MAX_PRODUCTS_PER_BLOCK, newBlock, type BlockType, type CollectionSort, type PageBlock } from "@/lib/storefront/page-blocks";
import type { CatalogOptions } from "@/lib/storefront/page-block-catalog";

type ImageFieldProps = { label: string; value: string; onChange: (v: string) => void };

const input = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";
const small = "mb-1 block text-[11px] text-muted-foreground";
const ADDABLE: BlockType[] = ["heading", "text", "image", "button", "faq", "gallery", "divider", "products", "collection"];
const EMPTY_OPTIONS: CatalogOptions = { products: [], categories: [] };
const SORT_LABELS: Record<CollectionSort, string> = { newest: "Newest first", "price-asc": "Price: low to high", "price-desc": "Price: high to low" };

/** Picks products for a Products block: search the catalogue, tap to add, remove from the chosen list. */
function ProductPicker({ chosen, options, onChange }: { chosen: string[]; options: CatalogOptions["products"]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState("");
  const byId = new Map(options.map((p) => [p.id, p]));
  const q = query.trim().toLowerCase();
  const matches = options.filter((p) => !chosen.includes(p.id) && (!q || p.name.toLowerCase().includes(q))).slice(0, 8);
  const full = chosen.length >= MAX_PRODUCTS_PER_BLOCK;
  return (
    <div className="space-y-2">
      {chosen.length > 0 && (
        <ul className="space-y-1">
          {chosen.map((id, n) => {
            const p = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-xs">
                <span className="min-w-0 flex-1 truncate">{p ? p.name : "Product no longer available"}</span>
                <button type="button" title="Move up" disabled={n === 0} onClick={() => { const next = [...chosen]; [next[n - 1], next[n]] = [next[n], next[n - 1]]; onChange(next); }} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                <button type="button" title="Move down" disabled={n === chosen.length - 1} onClick={() => { const next = [...chosen]; [next[n + 1], next[n]] = [next[n], next[n + 1]]; onChange(next); }} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                <button type="button" title="Remove product" onClick={() => onChange(chosen.filter((x) => x !== id))} className="rounded p-0.5 text-muted-foreground hover:bg-muted"><X className="h-3 w-3" /></button>
              </li>
            );
          })}
        </ul>
      )}
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">You have no published products yet. Add products first, then pick them here.</p>
      ) : full ? (
        <p className="text-xs text-muted-foreground">You can show up to {MAX_PRODUCTS_PER_BLOCK} products in one block. Add another Products block for more.</p>
      ) : (
        <>
          <input className={input} value={query} placeholder="Search your products" onChange={(e) => setQuery(e.target.value)} />
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onChange([...chosen, p.id])} className="flex w-full items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-left text-xs hover:bg-muted">
                  <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-1 text-xs text-muted-foreground">{q ? "No product matches that search." : "Every product is already added."}</li>}
          </ul>
          <p className="text-[11px] text-muted-foreground">{chosen.length}/{MAX_PRODUCTS_PER_BLOCK} chosen. Names, prices and photos update automatically when you change the product.</p>
        </>
      )}
    </div>
  );
}

/**
 * Block editor for a page's content. The parent owns the blocks and the Save button; ImageField is passed in so
 * image uploads use the same control as the rest of the customizer.
 */
export function PageBlockEditor({ blocks, onChange, ImageField, catalog = EMPTY_OPTIONS }: { blocks: PageBlock[]; onChange: (next: PageBlock[]) => void; ImageField: ComponentType<ImageFieldProps>; catalog?: CatalogOptions }) {
  const catalogBlocks = blocks.filter((b) => b.type === "products" || b.type === "collection").length;
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

          {b.type === "products" && (
            <div className="space-y-2">
              <label className="block"><span className={small}>Heading above the products (optional)</span><input className={input} maxLength={120} value={b.title} placeholder="Our favourites" onChange={(e) => patch(b.id, { title: e.target.value })} /></label>
              <ProductPicker chosen={b.productIds} options={catalog.products} onChange={(ids) => patch(b.id, { productIds: ids })} />
              {b.productIds.length === 0 && <p className="text-[11px] text-muted-foreground">A Products block with nothing chosen is not saved.</p>}
            </div>
          )}

          {b.type === "collection" && (
            <div className="space-y-2">
              <label className="block"><span className={small}>Heading above the products (optional)</span><input className={input} maxLength={120} value={b.title} placeholder="New arrivals" onChange={(e) => patch(b.id, { title: e.target.value })} /></label>
              <label className="block"><span className={small}>Show products from</span>
                <select className={input} value={b.categoryId} onChange={(e) => patch(b.id, { categoryId: e.target.value })}>
                  <option value="">All products</option>
                  {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {b.categoryId && !catalog.categories.some((c) => c.id === b.categoryId) && <option value={b.categoryId}>Category no longer available</option>}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className={small}>How many</span>
                  <select className={input} value={b.limit} onChange={(e) => patch(b.id, { limit: e.target.value === "12" ? 12 : e.target.value === "8" ? 8 : 4 })}>
                    {COLLECTION_LIMITS.map((n) => <option key={n} value={n}>{n} products</option>)}
                  </select>
                </label>
                <label className="block"><span className={small}>Order</span>
                  <select className={input} value={b.sort} onChange={(e) => patch(b.id, { sort: e.target.value as CollectionSort })}>
                    {(Object.keys(SORT_LABELS) as CollectionSort[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">Fills itself from your catalogue, so new products appear without editing this page.</p>
            </div>
          )}

          {b.type === "divider" && <p className="text-xs text-muted-foreground">A thin line between sections.</p>}
        </div>
      ))}

      {blocks.length < MAX_BLOCKS && (
        <div className="rounded-md border border-dashed border-border p-2">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Plus className="h-3 w-3" /> Add a block</p>
          <div className="flex flex-wrap gap-1.5">
            {ADDABLE.map((t) => {
              const capped = (t === "products" || t === "collection") && catalogBlocks >= MAX_CATALOG_BLOCKS;
              return (
                <button key={t} type="button" disabled={capped} title={capped ? `A page can have up to ${MAX_CATALOG_BLOCKS} product blocks` : undefined} onClick={() => onChange([...blocks, newBlock(t)])} className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-40">{BLOCK_LABELS[t]}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
