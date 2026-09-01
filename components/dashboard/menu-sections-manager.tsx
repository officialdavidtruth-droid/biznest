"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, LayoutList, Plus, Trash2 } from "lucide-react";
import { createCategory, deleteCategory, reorderCategory, setCategoryActive } from "@/lib/actions/category";

type Section = { id: string; name: string; isActive: boolean; itemCount: number };

export function MenuSectionsManager({ slug, initialSections }: { slug: string; initialSections: Section[] }) {
  const [sections, setSections] = useState(initialSections);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<any>, success: string) {
    setBusy(true);
    try {
      const result = await action();
      if (!result?.success) toast.error(result?.error ?? "Something went wrong");
      else toast.success(success);
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await run(() => createCategory(slug, { name, type: "PRODUCT" }), "Section added");
    if (result?.success) {
      setSections((prev) => [...prev, { id: result.data.id, name: name.trim(), isActive: true, itemCount: 0 }]);
      setName("");
    }
  }

  async function toggleActive(section: Section) {
    const result = await run(() => setCategoryActive(slug, section.id, !section.isActive), "Updated");
    if (result?.success) setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, isActive: !s.isActive } : s)));
  }

  async function move(section: Section, direction: "up" | "down") {
    const index = sections.findIndex((s) => s.id === section.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) return;
    const result = await run(() => reorderCategory(slug, section.id, direction), "Reordered");
    if (result?.success) {
      setSections((prev) => {
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    }
  }

  async function remove(section: Section) {
    if (!window.confirm(`Delete "${section.name}"?`)) return;
    const result = await run(() => deleteCategory(slug, section.id), "Section deleted");
    if (result?.success) setSections((prev) => prev.filter((s) => s.id !== section.id));
    else if (!result?.success) toast.error(result?.error);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <LayoutList className="h-4 w-4" /> New Menu Section
        </h3>
        <form onSubmit={addSection} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "Breakfast", "Mains", "Drinks"' className="flex-1 rounded-lg border px-3 py-2 text-sm" />
          <button disabled={busy} type="submit" className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600">
            <Plus className="h-4 w-4" /> Add Section
          </button>
        </form>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold">Menu Order</h3>
        <p className="mb-4 text-xs text-muted-foreground">This is the order sections appear on your storefront menu.</p>
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sections yet — add one above.</p>
        ) : (
          <ul className="divide-y">
            {sections.map((section, i) => (
              <li key={section.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{section.name}</p>
                    <p className="text-xs text-muted-foreground">{section.itemCount} item{section.itemCount === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input type="checkbox" checked={section.isActive} onChange={() => toggleActive(section)} /> Visible
                  </label>
                  <button disabled={i === 0 || busy} onClick={() => move(section, "up")} className="rounded-lg border p-1.5 hover:bg-muted disabled:opacity-30">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button disabled={i === sections.length - 1 || busy} onClick={() => move(section, "down")} className="rounded-lg border p-1.5 hover:bg-muted disabled:opacity-30">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(section)} className="text-rose-500 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
