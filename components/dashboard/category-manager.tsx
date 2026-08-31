"use client";

import { useMemo, useState } from "react";
import { createCategory, updateCategory, deleteCategory, setCategoryActive, reorderCategory } from "@/lib/actions/category";
import { toast } from "sonner";
import { FolderTree, Plus, Pencil, Trash2 } from "lucide-react";
import { getBusinessTerminology } from "@/lib/business-terminology";

type Category = { id: string; storeId: string | null; name: string; type: "PRODUCT" | "SERVICE"; parentId: string | null; sortOrder: number; isActive: boolean; imageUrl: string | null; icon: string | null };

export function CategoryManager({ slug, initialCategories, businessCategory }: { slug: string; initialCategories: Category[]; businessCategory?: string | null }) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [type, setType] = useState<"PRODUCT"|"SERVICE">("PRODUCT");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const terminology = getBusinessTerminology(businessCategory);

  const top = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  const children = (id: string) => categories.filter(c => c.parentId === id);

  async function add() {
    setSaving(true);
    const r = await createCategory(slug, { name, type, parentId: parentId || null });
    setSaving(false);
    if (!r.success) return toast.error(r.error);
    const fresh = { id: r.data.id, storeId: "local", name: name.trim(), type, parentId: parentId || null, sortOrder: 0, isActive: true, imageUrl: null, icon: null };
    setCategories(v => [...v, fresh]);
    setName(""); setParentId("");
    toast.success("Category created");
  }
  async function edit(id: string) {
    const row = categories.find(c => c.id === id); if (!row) return;
    const next = window.prompt("Category name", row.name)?.trim(); if (!next || next === row.name) return;
    const r = await updateCategory(slug, id, { name: next, parentId: row.parentId });
    if (!r.success) return toast.error(r.error);
    setCategories(v => v.map(c => c.id === id ? {...c, name: next} : c)); toast.success("Category updated");
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this category?")) return;
    const r = await deleteCategory(slug, id);
    if (!r.success) return toast.error(r.error);
    setCategories(v => v.filter(c => c.id !== id)); toast.success("Category deleted");
  }

  return <div className="space-y-6">
    <p className="text-sm text-muted-foreground">{terminology.categoriesIntro}</p>
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2 font-medium"><Plus className="h-4 w-4" /> Add {terminology.category}</div>
      <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder={businessCategory === "Restaurant" ? "e.g. Pizza, Sandwiches, Drinks" : "e.g. Rooms"} className="h-10 rounded-lg border bg-background px-3 text-sm" />
        <select value={type} onChange={e=>setType(e.target.value as any)} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="PRODUCT">{terminology.catalogSingular}</option><option value="SERVICE">Service</option></select>
        <select value={parentId} onChange={e=>setParentId(e.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="">Top-level {terminology.category.toLowerCase()}</option>{top.filter(c=>c.type===type).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button onClick={add} disabled={!name.trim() || saving} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : `Add ${terminology.category}`}</button>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      {top.map(c => <div key={c.id} className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-muted p-2"><FolderTree className="h-5 w-5"/></div><div><h2 className="font-semibold">{c.name}</h2><p className="text-xs text-muted-foreground">{children(c.id).length} subcategories · {c.type === "PRODUCT" ? terminology.catalog : "Services"}</p></div></div>
          <div className="flex gap-1"><button onClick={()=>reorderCategory(slug,c.id,"up").then(r=>{if(!r.success)toast.error(r.error);else location.reload()})} className="rounded-lg p-2 hover:bg-muted" aria-label="Move up">↑</button><button onClick={()=>reorderCategory(slug,c.id,"down").then(r=>{if(!r.success)toast.error(r.error);else location.reload()})} className="rounded-lg p-2 hover:bg-muted" aria-label="Move down">↓</button><button onClick={()=>edit(c.id)} className="rounded-lg p-2 hover:bg-muted" aria-label="Edit"><Pencil className="h-4 w-4"/></button><button onClick={()=>setCategoryActive(slug,c.id,!c.isActive).then(r=>{if(!r.success)toast.error(r.error);else setCategories(v=>v.map(x=>x.id===c.id?{...x,isActive:!x.isActive}:x))})} className="rounded-lg px-2 text-xs hover:bg-muted">{c.isActive?"Active":"Inactive"}</button><button onClick={()=>remove(c.id)} className="rounded-lg p-2 text-destructive hover:bg-muted" aria-label="Delete"><Trash2 className="h-4 w-4"/></button></div>
        </div>
        {children(c.id).length > 0 && <div className="mt-4 flex flex-wrap gap-2">{children(c.id).map(s=><span key={s.id} className="group inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs">{s.name}<button onClick={()=>edit(s.id)} className="ml-1 opacity-60 hover:opacity-100"><Pencil className="h-3 w-3"/></button></span>)}</div>}
      </div>)}
      {top.length === 0 && <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No categories yet. Add your first category above.</div>}
    </div>
  </div>;
}
