"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { createCategory, deleteCategory, renameCategory, reorderCategory, setCategoryActive } from "@/lib/actions/category";
import { deleteBlockReason, type SimpleCategoryRow } from "@/lib/storefront/simple-categories";

type Props = {
  slug: string;
  initialRows: SimpleCategoryRow[];
  canEdit: boolean;
  /** e.g. "category" / "collection": the word this business uses. */
  singular: string;
  /** Both products and services: the owner picks which kind a new one is for. */
  offersBoth: boolean;
  defaultType: "PRODUCT" | "SERVICE";
};

/** Simple mode's Categories: add, rename, reorder, show or hide. Nothing technical. */
export function SimpleCategoryList({ slug, initialRows, canEdit, singular, offersBoth, defaultType }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [name, setName] = useState("");
  const [type, setType] = useState<"PRODUCT" | "SERVICE">(defaultType);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const lower = singular.toLowerCase();

  function run<T extends { success: boolean; error?: string }>(work: () => Promise<T>, onOk: (r: T) => void) {
    startTransition(async () => {
      try {
        const r = await work();
        if (!r.success) toast.error(r.error ?? "Something went wrong. Please try again.");
        else onOk(r);
      } catch {
        toast.error("Couldn't save. Check your connection and try again.");
      }
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    run(() => createCategory(slug, { name: value, type }), (r) => {
      const id = (r as unknown as { data: { id: string } }).data.id;
      setRows((rs) => [...rs, { id, name: value, type, isActive: true, itemCount: 0, subcategoryCount: 0 }]);
      setName("");
      toast.success(`Added “${value}”.`);
    });
  }

  function rename(row: SimpleCategoryRow) {
    const value = (editing?.value ?? "").trim();
    if (!value || value === row.name) { setEditing(null); return; }
    run(() => renameCategory(slug, row.id, value), () => {
      setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, name: value } : x)));
      setEditing(null);
      toast.success("Renamed.");
    });
  }

  function toggle(row: SimpleCategoryRow) {
    run(() => setCategoryActive(slug, row.id, !row.isActive), () => {
      setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, isActive: !x.isActive } : x)));
    });
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const row = rows[index];
    run(() => reorderCategory(slug, row.id, dir === -1 ? "up" : "down"), () => {
      setRows((rs) => {
        const next = [...rs];
        [next[index], next[j]] = [next[j], next[index]];
        return next;
      });
    });
  }

  function remove(row: SimpleCategoryRow) {
    const blocked = deleteBlockReason(row);
    if (blocked) { toast.error(blocked); return; }
    if (!window.confirm(`Delete “${row.name}”? This can't be undone.`)) return;
    run(() => deleteCategory(slug, row.id), () => {
      setRows((rs) => rs.filter((x) => x.id !== row.id));
      toast.success("Deleted.");
    });
  }

  const iconBtn = "flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-30";

  return (
    <div className="space-y-4">
      {canEdit && (
        <form onSubmit={add} className="rounded-xl border border-border bg-card p-4">
          <label htmlFor="new-category" className="mb-2 block text-sm font-semibold">Add a {lower}</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="new-category"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Cakes, Haircuts, Shoes"
              className="min-h-10 flex-1 rounded-md border px-3 py-2 text-sm"
            />
            {offersBoth && (
              <select value={type} onChange={(e) => setType(e.target.value as "PRODUCT" | "SERVICE")} aria-label="What is it for?" className="min-h-10 rounded-md border px-3 py-2 text-sm">
                <option value="PRODUCT">For things I sell</option>
                <option value="SERVICE">For services I offer</option>
              </select>
            )}
            <button type="submit" disabled={pending || !name.trim()} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          You haven’t added a {lower} yet. Add your first one above.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border border-border bg-card">
          {rows.map((row, i) => (
            <li key={row.id} className="space-y-2 px-3 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.isActive}
                  aria-label={`Show ${row.name} on my website`}
                  disabled={!canEdit || pending}
                  onClick={() => toggle(row)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${row.isActive ? "bg-emerald-600" : "bg-muted-foreground/30"}`}
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${row.isActive ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <div className="min-w-0 flex-1">
                  {editing?.id === row.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); rename(row); }} className="flex gap-2">
                      <input autoFocus value={editing.value} onChange={(e) => setEditing({ id: row.id, value: e.target.value })} maxLength={80} aria-label={`New name for ${row.name}`} className="min-h-10 min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm" />
                      <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">Save</button>
                      <button type="button" onClick={() => setEditing(null)} className="rounded-md border px-3 text-sm">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <p className={`truncate text-sm font-medium ${row.isActive ? "" : "text-muted-foreground"}`}>{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.itemCount} {row.itemCount === 1 ? "item" : "items"}
                        {!row.isActive && " · Hidden on your website"}
                        {offersBoth && ` · ${row.type === "SERVICE" ? "Services" : "Products"}`}
                        {row.subcategoryCount > 0 && ` · ${row.subcategoryCount} subcategories (Advanced options)`}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {canEdit && editing?.id !== row.id && (
                <div className="flex flex-wrap gap-1 pl-[60px]">
                  <button type="button" aria-label={`Move ${row.name} up`} disabled={i === 0 || pending} onClick={() => move(i, -1)} className={iconBtn}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Move ${row.name} down`} disabled={i === rows.length - 1 || pending} onClick={() => move(i, 1)} className={iconBtn}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Rename ${row.name}`} disabled={pending} onClick={() => setEditing({ id: row.id, value: row.name })} className={iconBtn}><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Delete ${row.name}`} disabled={pending} onClick={() => remove(row)} className={`${iconBtn} text-destructive`}><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!canEdit && <p className="text-xs text-muted-foreground">Only the owner or a manager can change categories.</p>}
    </div>
  );
}
