"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronRight, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { saveStoreMenu, resetStoreMenu, type MenuNodeInput } from "@/lib/actions/store-menu";
import { MENU_PAGE_OPTIONS, type MenuLinkType } from "@/lib/storefront-menu";

type Category = { id: string; name: string; parentId: string | null };
type CustomPage = { slug: string; title: string };
type MNode = { key: string; label: string; linkType: MenuLinkType; target?: string | null; openInNewTab?: boolean; children: MNode[] };

let seq = 0;
const newKey = () => `n${++seq}`;
const withKeys = (list: MenuNodeInput[]): MNode[] =>
  list.map((n) => ({ ...n, key: newKey(), children: withKeys(n.children ?? []) }));
const strip = (list: MNode[]): MenuNodeInput[] =>
  list.map(({ key: _k, children, ...n }) => ({ ...n, children: strip(children) }));

const blank = (): MNode => ({ key: newKey(), label: "", linkType: "PAGE", target: "/", openInNewTab: false, children: [] });

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export function MenuManager({
  slug, initialTree, categories, pages, pageOptions, hasCustomMenu,
}: { slug: string; initialTree: MenuNodeInput[]; categories: Category[]; pages: CustomPage[]; pageOptions?: { label: string; path: string }[]; hasCustomMenu: boolean }) {
  const [tree, setTree] = useState<MNode[]>(() => withKeys(initialTree));
  const [custom, setCustom] = useState(hasCustomMenu);
  const [pending, start] = useTransition();

  const update = (path: number[], fn: (n: MNode) => MNode) =>
    setTree((t) => t.map((n, i) => (i !== path[0] ? n : path.length === 1 ? fn(n) : { ...n, children: n.children.map((c, j) => (j === path[1] ? fn(c) : c)) })));

  const addTop = () => setTree((t) => [...t, blank()]);
  const addChild = (i: number) => setTree((t) => t.map((n, k) => (k === i ? { ...n, children: [...n.children, blank()] } : n)));
  const remove = (path: number[]) =>
    setTree((t) => (path.length === 1 ? t.filter((_, i) => i !== path[0]) : t.map((n, i) => (i === path[0] ? { ...n, children: n.children.filter((_, j) => j !== path[1]) } : n))));
  const reorder = (path: number[], dir: -1 | 1) =>
    setTree((t) => (path.length === 1 ? move(t, path[0], dir) : t.map((n, i) => (i === path[0] ? { ...n, children: move(n.children, path[1], dir) } : n))));

  const setType = (path: number[], linkType: MenuLinkType) =>
    update(path, (n) => ({
      ...n,
      linkType,
      target: linkType === "PAGE" ? "/" : linkType === "CATEGORY" ? categories[0]?.id ?? "" : "",
    }));

  // Picking a page/category with an empty label pre-fills the label (like WordPress).
  const setTarget = (path: number[], target: string) =>
    update(path, (n) => {
      let label = n.label;
      if (!label.trim()) {
        if (n.linkType === "PAGE") label = MENU_PAGE_OPTIONS.find((p) => p.path === target)?.label ?? pages.find((p) => `/${p.slug}` === target)?.title ?? "";
        if (n.linkType === "CATEGORY") label = categories.find((c) => c.id === target)?.name ?? "";
      }
      return { ...n, target, label };
    });

  const save = () =>
    start(async () => {
      const res = await saveStoreMenu(slug, strip(tree));
      if (res.success) { setCustom(true); toast.success("Menu saved. Your storefront now uses it."); }
      else toast.error(res.error);
    });

  const reset = () => {
    if (!confirm("Remove your custom menu and go back to the template's default links?")) return;
    start(async () => {
      const res = await resetStoreMenu(slug);
      if (res.success) { setTree([]); setCustom(false); toast.success("Menu reset to the template default."); }
      else toast.error(res.error);
    });
  };

  const loadStarter = () => {
    setTree(withKeys([
      { label: "Home", linkType: "PAGE", target: "/" },
      { label: "About", linkType: "PAGE", target: "/about" },
      { label: "Contact", linkType: "PAGE", target: "/contact" },
      ...categories.filter((c) => !c.parentId).slice(0, 5).map((c) => ({
        label: c.name, linkType: "CATEGORY" as const, target: c.id,
        children: categories.filter((s) => s.parentId === c.id).map((s) => ({ label: s.name, linkType: "CATEGORY" as const, target: s.id })),
      })),
    ]));
  };

  const row = (n: MNode, path: number[], count: number) => {
    const isChild = path.length === 2;
    return (
      <div key={n.key} className={`rounded-xl border bg-background p-3 ${isChild ? "ml-8 mt-2" : "mt-3"}`}>
        <div className="grid gap-2 md:grid-cols-[1.1fr_0.8fr_1.4fr_auto]">
          <input
            value={n.label} placeholder="Label (what visitors see)" maxLength={40}
            onChange={(e) => update(path, (x) => ({ ...x, label: e.target.value }))}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select value={n.linkType} onChange={(e) => setType(path, e.target.value as MenuLinkType)} className="rounded-lg border px-3 py-2 text-sm">
            <option value="PAGE">Page</option>
            <option value="CATEGORY">Category</option>
            <option value="CUSTOM">Custom link</option>
          </select>
          {n.linkType === "PAGE" && (
            <select value={n.target ?? "/"} onChange={(e) => setTarget(path, e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              {(pageOptions ?? MENU_PAGE_OPTIONS).map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
              {pages.length > 0 && (
                <optgroup label="Your pages">
                  {pages.map((p) => <option key={p.slug} value={`/${p.slug}`}>{p.title}</option>)}
                </optgroup>
              )}
            </select>
          )}
          {n.linkType === "CATEGORY" && (
            <select value={n.target ?? ""} onChange={(e) => setTarget(path, e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}
            </select>
          )}
          {n.linkType === "CUSTOM" && (
            <input value={n.target ?? ""} placeholder="https://… or /path or #section" onChange={(e) => update(path, (x) => ({ ...x, target: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
          )}
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Move up" disabled={path[path.length - 1] === 0} onClick={() => reorder(path, -1)} className="rounded-lg border p-2 disabled:opacity-30"><ArrowUp size={14} /></button>
            <button type="button" aria-label="Move down" disabled={path[path.length - 1] === count - 1} onClick={() => reorder(path, 1)} className="rounded-lg border p-2 disabled:opacity-30"><ArrowDown size={14} /></button>
            <button type="button" aria-label="Delete" onClick={() => remove(path)} className="rounded-lg border p-2 text-red-600"><Trash2 size={14} /></button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!n.openInNewTab} onChange={(e) => update(path, (x) => ({ ...x, openInNewTab: e.target.checked }))} /> Open in new tab</label>
          {!isChild && <button type="button" onClick={() => addChild(path[0])} className="flex items-center gap-1 font-semibold text-primary"><Plus size={12} /> Add dropdown item</button>}
        </div>
        {n.children.map((c, j) => row(c, [path[0], j], n.children.length))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Menus</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Build the navigation shown at the top of your website. Add pages, categories or custom links, and nest items under a parent to make a dropdown.
          {custom ? " Your website is using this custom menu." : " Until you save one, your website uses its template's default links."}
        </p>
      </div>

      {tree.length === 0 && (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No custom menu yet.</p>
          <div className="mt-3 flex justify-center gap-2">
            <button type="button" onClick={addTop} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Start from scratch</button>
            <button type="button" onClick={loadStarter} className="rounded-lg border px-4 py-2 text-xs font-bold">Start from my categories</button>
          </div>
        </div>
      )}

      <div>{tree.map((n, i) => row(n, [i], tree.length))}</div>

      {tree.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={addTop} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"><Plus size={14} /> Add menu item</button>
          <button type="button" disabled={pending} onClick={save} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"><Save size={14} /> {pending ? "Saving…" : "Save menu"}</button>
          {custom && <button type="button" disabled={pending} onClick={reset} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"><RotateCcw size={14} /> Reset to template default</button>}
        </div>
      )}

      {tree.length > 0 && (
        <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-bold text-foreground">Preview</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {tree.map((n) => (
              <span key={n.key} className="font-semibold text-foreground">
                {n.label || "…"}{n.children.length > 0 && <ChevronRight size={11} className="ml-0.5 inline rotate-90" />}
                {n.children.length > 0 && <span className="ml-1 font-normal text-muted-foreground">({n.children.map((c) => c.label || "…").join(", ")})</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
