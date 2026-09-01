"use client";

import { useMemo, useState } from "react";
import { createCategory, updateCategory, deleteCategory, setCategoryActive, reorderCategory } from "@/lib/actions/category";
import { toast } from "sonner";
import {
  FolderTree,
  LayoutGrid,
  CheckCircle2,
  Package,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Lightbulb,
} from "lucide-react";
import { StatCard, ListToolbar } from "@/components/dashboard/list-toolbar";
import type { BusinessTerminology } from "@/lib/business-terminology";

type Category = {
  id: string;
  storeId: string | null;
  name: string;
  description: string | null;
  type: "PRODUCT" | "SERVICE";
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string | null;
  icon: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StatusFilter = "all" | "active" | "inactive";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CategoryManager({
  slug,
  initialCategories,
  itemCounts,
  terminology,
  businessCategory,
}: {
  slug: string;
  initialCategories: Category[];
  itemCounts: Record<string, number>;
  terminology: BusinessTerminology;
  businessCategory?: string | null;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialCategories.find((c) => !c.parentId)?.id ?? null);
  const [formOpen, setFormOpen] = useState<null | "new" | string>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const top = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const children = (id: string) => categories.filter((c) => c.parentId === id);
  const itemsFor = (c: Category) => (itemCounts[c.id] ?? 0) + children(c.id).reduce((sum, s) => sum + (itemCounts[s.id] ?? 0), 0);

  const filtered = useMemo(() => {
    return top
      .filter((c) => (tab === "all" ? true : tab === "active" ? c.isActive : !c.isActive))
      .filter((c) => (search.trim() ? c.name.toLowerCase().includes(search.trim().toLowerCase()) : true))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [top, tab, search]);

  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const totalItems = top.reduce((sum, c) => sum + itemsFor(c), 0);
  const activeCount = top.filter((c) => c.isActive).length;
  const avgItems = top.length ? (totalItems / top.length).toFixed(1) : "0";

  async function toggleActive(c: Category) {
    const r = await setCategoryActive(slug, c.id, !c.isActive);
    if (!r.success) return toast.error(r.error);
    setCategories((v) => v.map((x) => (x.id === c.id ? { ...x, isActive: !x.isActive } : x)));
    toast.success(!c.isActive ? "Category activated" : "Category deactivated");
  }

  async function move(c: Category, direction: "up" | "down") {
    const r = await reorderCategory(slug, c.id, direction);
    if (!r.success) return toast.error(r.error);
    const siblings = top.filter((x) => x.parentId === c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = siblings.findIndex((x) => x.id === c.id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;
    const other = siblings[targetIdx];
    setCategories((v) =>
      v.map((x) => {
        if (x.id === c.id) return { ...x, sortOrder: other.sortOrder };
        if (x.id === other.id) return { ...x, sortOrder: c.sortOrder };
        return x;
      })
    );
  }

  async function remove(c: Category) {
    if (!window.confirm(`Delete "${c.name}"? This can't be undone.`)) return;
    const r = await deleteCategory(slug, c.id);
    if (!r.success) return toast.error(r.error);
    setCategories((v) => v.filter((x) => x.id !== c.id));
    if (selectedId === c.id) setSelectedId(top.find((x) => x.id !== c.id)?.id ?? null);
    toast.success(`${terminology.category} deleted`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{terminology.category}s</h1>
          <p className="mt-1 text-sm text-muted-foreground">{terminology.categoriesIntro}</p>
        </div>
        <button
          onClick={() => setFormOpen("new")}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add {terminology.category}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderTree} tone="purple" label={`Total ${terminology.category}s`} value={top.length} note={`All ${terminology.category.toLowerCase()}s`} />
        <StatCard icon={CheckCircle2} tone="green" label={`Active ${terminology.category}s`} value={activeCount} note="Currently active" />
        <StatCard icon={Package} tone="blue" label={terminology.catalog} value={totalItems} note={`Across all ${terminology.category.toLowerCase()}s`} />
        <StatCard icon={BarChart3} tone="orange" label={`Avg ${terminology.catalogSingular.toLowerCase()}s / ${terminology.category.toLowerCase()}`} value={avgItems} note="Average items" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-1 border-b px-4 pt-3">
            {(["all", "active", "inactive"] as StatusFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-t-lg px-3 pb-3 text-sm font-medium capitalize ${
                  tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? `All ${terminology.category}s` : t}
              </button>
            ))}
          </div>

          <div className="p-4">
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={`Search ${terminology.category.toLowerCase()}s...`}
              filters={[]}
              onReset={() => {
                setSearch("");
                setTab("all");
              }}
            />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{terminology.category}</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">{terminology.catalog}</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Order</th>
                    <th className="py-2 pl-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`cursor-pointer border-b last:border-0 hover:bg-slate-50 ${selectedId === c.id ? "bg-primary/5" : ""}`}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <FolderTree className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="max-w-[220px] truncate py-3 pr-3 text-muted-foreground">{c.description || "—"}</td>
                      <td className="py-3 pr-3">{itemsFor(c)}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            c.isActive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
                          }`}
                        >
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">{c.sortOrder + 1}</td>
                      <td className="py-3 pl-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => move(c, "up")} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Move up">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => move(c, "down")} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Move down">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setFormOpen(c.id)} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => remove(c)} className="rounded-lg p-1.5 text-destructive hover:bg-muted" aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No {terminology.category.toLowerCase()}s yet. Add your first one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{terminology.category} Details</h2>
            </div>
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <FolderTree className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">{selected.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${selected.isActive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                      {selected.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm">{selected.description || "No description yet."}</p>
                </div>
                <dl className="space-y-2 text-xs">
                  <div className="flex items-center justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><LayoutGrid className="h-3.5 w-3.5" /> {terminology.catalog}</dt><dd className="font-medium">{itemsFor(selected)} items</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-muted-foreground">Display order</dt><dd className="font-medium">{selected.sortOrder + 1}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-muted-foreground">Created</dt><dd className="font-medium">{fmtDate(selected.createdAt)}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{fmtDate(selected.updatedAt)}</dd></div>
                </dl>
                <button
                  onClick={() => setFormOpen(selected.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit {terminology.category}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a {terminology.category.toLowerCase()} to see its details.</p>
            )}
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFormOpen("new")} className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium hover:bg-muted">
                <Plus className="h-4 w-4" /> Add {terminology.category}
              </button>
              <button
                onClick={() => selected && move(selected, "up")}
                className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium hover:bg-muted disabled:opacity-40"
                disabled={!selected}
              >
                <ArrowUp className="h-4 w-4" /> Reorder
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-900">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{terminology.category}s help organize your {terminology.catalog.toLowerCase()} and make it easier for {terminology.customer.toLowerCase()}s to find what they're looking for.</p>
          </div>
        </aside>
      </div>

      {formOpen && (
        <CategoryFormModal
          slug={slug}
          terminology={terminology}
          businessCategory={businessCategory}
          topCategories={top}
          category={formOpen === "new" ? null : categories.find((c) => c.id === formOpen) ?? null}
          saving={savingId === formOpen}
          onClose={() => setFormOpen(null)}
          onSaved={(saved, isNew) => {
            setCategories((v) => (isNew ? [...v, saved] : v.map((c) => (c.id === saved.id ? saved : c))));
            setSelectedId(saved.id);
            setFormOpen(null);
          }}
          setSavingId={setSavingId}
        />
      )}
    </div>
  );
}

function CategoryFormModal({
  slug,
  terminology,
  businessCategory,
  topCategories,
  category,
  onClose,
  onSaved,
  setSavingId,
  saving,
}: {
  slug: string;
  terminology: BusinessTerminology;
  businessCategory?: string | null;
  topCategories: Category[];
  category: Category | null;
  onClose: () => void;
  onSaved: (c: Category, isNew: boolean) => void;
  setSavingId: (id: string | null) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [type, setType] = useState<"PRODUCT" | "SERVICE">(category?.type ?? "PRODUCT");
  const [parentId, setParentId] = useState(category?.parentId ?? "");

  async function save() {
    if (!name.trim()) return toast.error(`${terminology.category} name is required.`);
    setSavingId(category?.id ?? "new");
    if (category) {
      const r = await updateCategory(slug, category.id, { name, description, parentId: parentId || null });
      setSavingId(null);
      if (!r.success) return toast.error(r.error);
      onSaved({ ...category, name: name.trim(), description: description.trim() || null, parentId: parentId || null }, false);
      toast.success(`${terminology.category} updated`);
    } else {
      const r = await createCategory(slug, { name, description, type, parentId: parentId || null });
      setSavingId(null);
      if (!r.success) return toast.error(r.error);
      onSaved(
        {
          id: r.data.id,
          storeId: null,
          name: name.trim(),
          description: description.trim() || null,
          type,
          parentId: parentId || null,
          sortOrder: 0,
          isActive: true,
          imageUrl: null,
          icon: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        true
      );
      toast.success(`${terminology.category} created`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{category ? `Edit ${terminology.category}` : `Add ${terminology.category}`}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={businessCategory === "Restaurant" ? "e.g. Main Courses, Desserts" : `e.g. ${terminology.catalogSingular}`}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What kind of items belong here?"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          {!category && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                <option value="PRODUCT">{terminology.catalogSingular}</option>
                <option value="SERVICE">Service</option>
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Parent {terminology.category.toLowerCase()}</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Top-level {terminology.category.toLowerCase()}</option>
              {topCategories.filter((c) => c.id !== category?.id && c.type === type).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? "Saving…" : category ? "Save Changes" : `Add ${terminology.category}`}
          </button>
        </div>
      </div>
    </div>
  );
}
