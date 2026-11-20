"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ChefHat, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { createFnbDish, createFnbIngredient, saveFnbRecipe, saveFnbStation } from "@/lib/actions/fnb";
import { extractFnbRecipe } from "@/lib/fnb-utils";
import { Avatar, Chip, Empty, Field, Meter, Page, Section, Segmented, btnGhost, btnPrimary, card, input, money, toneStyle, type Tone } from "./ui";

const STATIONS = ["Hot Kitchen", "Grill", "Cold", "Drinks", "Pizza", "Dessert", "Expo"];
const attrsOf = (p: any) => (p.attributes && typeof p.attributes === "object" && !Array.isArray(p.attributes) ? p.attributes : {}) as Record<string, any>;
const isIngredientProduct = (p: any) => Boolean(attrsOf(p).fnbIngredient);

/** Cost of one portion of a dish from its saved recipe, or null if any ingredient has no cost. */
function dishCost(p: any, inventory: any[]): number | null {
  const r = extractFnbRecipe(p.attributes);
  if (!r || r.ingredients.length === 0) return null;
  let total = 0;
  for (const i of r.ingredients) {
    const v = inventory.find((x: any) => x.id === i.inventoryItemId);
    const c = v ? (v.costPrice != null ? Number(v.costPrice) : v.product.isPublished === false ? Number(v.product.price) : null) : null;
    if (c == null) return null;
    total += c * i.quantity;
  }
  return total / (r.yieldQty > 0 ? r.yieldQty : 1);
}
function marginTone(pct: number): Tone { return pct >= 65 ? "ok" : pct >= 50 ? "warn" : "bad"; }

/* ───────────── Menu ───────────── */
export function MenuPanel({ slug, products, inventory, role, kitchenInstalled, kitchenHref }: { slug: string; products: any[]; inventory: any[]; role: string; kitchenInstalled: boolean; kitchenHref: string }) {
  const canEdit = role !== "STAFF";
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, start] = useTransition();
  const [d, setD] = useState({ name: "", price: "", description: "", station: "Hot Kitchen", quantity: "" });
  const addDish = () => start(async () => {
    const r = await createFnbDish(slug, { name: d.name, price: Number(d.price), description: d.description, station: d.station, quantity: d.quantity ? Number(d.quantity) : 0 });
    if (!r.success) { toast.error(r.error); return; }
    setD({ name: "", price: "", description: "", station: "Hot Kitchen", quantity: "" }); setAdding(false);
    if (kitchenInstalled) { toast.success(`${r.data.name} added — now build its recipe`); window.location.assign(`${kitchenHref}?dish=${r.data.productId}#recipes`); return; }
    toast.success(`${r.data.name} added to your menu`); router.refresh();
  });
  const [q, setQ] = useState("");
  const [st, setSt] = useState("All");
  const dishes = products.filter((p) => !isIngredientProduct(p));
  const list = dishes.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) && (st === "All" || (attrsOf(p).fnbStation || "Hot Kitchen") === st));
  const usedStations = ["All", ...STATIONS.filter((s) => dishes.some((p) => (attrsOf(p).fnbStation || "Hot Kitchen") === s))];
  const saveStation = (productId: string, station: string) => { void (async () => { const r = await saveFnbStation(slug, productId, station); if (!r.success) toast.error(r.error); else toast.success("Kitchen station updated"); })(); };
  return <Page title="Menu" sub="Your dishes and where each one is cooked. Prices live in the catalog." action={canEdit ? <button onClick={() => setAdding((v) => !v)} className={btnPrimary}><Plus className="h-4 w-4" />{adding ? "Cancel" : "Add dish"}</button> : undefined}>
    {adding && <Section title="New dish" hint={kitchenInstalled ? "Add it here, then you'll go straight to its recipe." : "Add it here and it goes on your menu."}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dish name"><input className={input} placeholder="e.g. Jollof rice & chicken" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Price guests pay"><input className={input} type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 4500" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Short description (optional)"><input className={input} maxLength={255} placeholder="What guests see on your menu" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field></div>
        <Field label="Cooked at"><select className={input} value={d.station} onChange={(e) => setD({ ...d, station: e.target.value })}>{STATIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Portions ready (optional)" hint={kitchenInstalled ? "Skip this if you'll add a recipe. Dishes with a recipe use ingredient stock." : "How many you can serve right now. Leave empty if unlimited is not needed."}><input className={input} type="number" inputMode="numeric" min="0" value={d.quantity} onChange={(e) => setD({ ...d, quantity: e.target.value })} /></Field>
      </div>
      <button disabled={busy} onClick={addDish} className={`${btnPrimary} mt-4 w-full`}>{busy ? "Adding…" : kitchenInstalled ? "Add dish & build recipe" : "Add dish"}</button>
    </Section>}
    <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[var(--bn-admin-muted)]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes" className={`${input} pl-10`} /></div>
    {usedStations.length > 2 && <Segmented scroll value={st} onChange={setSt} options={usedStations.map((s) => ({ id: s, label: s }))} />}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((p) => {
      const a = attrsOf(p); const station = typeof a.fnbStation === "string" ? a.fnbStation : "Hot Kitchen";
      const cost = kitchenInstalled ? dishCost(p, inventory) : null; const pct = cost != null && p.price > 0 ? Math.round(((p.price - cost) / p.price) * 100) : null;
      return <div key={p.id} className={`${card} p-4`}>
        <div className="flex items-start gap-3">
          <Avatar name={p.name} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{p.name}</p><p className="mt-0.5 text-sm font-extrabold text-[var(--bn-admin-active)]">{money(p.price)}</p></div>
          <Chip tone={p.isPublished ? "ok" : "mute"} dot>{p.isPublished ? "On menu" : "Hidden"}</Chip>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {pct != null ? <Chip tone={marginTone(pct)}>{pct}% margin</Chip> : kitchenInstalled ? <a href={`${kitchenHref}?dish=${p.id}#recipes`} className="rounded-full bg-[var(--bn-admin-surface-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--bn-admin-muted)]">No recipe yet · add</a> : <span />}
          <select disabled={!canEdit} defaultValue={station} onChange={(e) => saveStation(p.id, e.target.value)} aria-label={`Kitchen station for ${p.name}`} className="ml-auto min-h-9 rounded-lg border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] px-2 text-xs font-semibold text-[var(--bn-admin-text)] disabled:opacity-60">{STATIONS.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </div>; })}
    {list.length === 0 && <Empty icon={UtensilsCrossed} title={dishes.length ? "No dishes match" : "Your menu is empty"} text={dishes.length ? "Try a different search or station." : "Add your first dish from the catalog."} />}</div>
  </Page>;
}

/* ───────────── Recipes & food cost ───────────── */
type Row = { inventoryItemId: string; quantity: string; unit: string };

export function RecipesPanel({ slug, products: allProducts, inventory, role, initialId }: { slug: string; products: any[]; inventory: any[]; role: string; initialId?: string | null }) {
  const products = allProducts.filter((p) => !isIngredientProduct(p));
  const canEdit = role !== "STAFF";
  const [productId, setProductId] = useState<string | null>(initialId ?? null);
  const product = products.find((p) => p.id === productId) || null;
  return <Page title="Recipes & food cost" sub="Build each dish from your ingredients to see what it costs and what you keep.">
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className={`${product ? "hidden lg:block" : ""} space-y-2.5`}>
        {products.map((p) => { const cost = dishCost(p, inventory); const pct = cost != null && p.price > 0 ? Math.round(((p.price - cost) / p.price) * 100) : null; const has = Boolean(extractFnbRecipe(p.attributes)); const on = p.id === productId;
          return <button key={p.id} onClick={() => setProductId(p.id)} className={`${card} flex w-full items-center gap-3 p-3.5 text-left ${on ? "!border-[var(--bn-admin-active)] ring-2 ring-[color-mix(in_srgb,var(--bn-admin-active)_20%,transparent)]" : ""}`}>
            <Avatar name={p.name} tone={has ? "ok" : "mute"} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{p.name}</p><p className="text-[11px] text-[var(--bn-admin-muted)]">{money(p.price)}{cost != null ? ` · costs ${money(cost)}` : ""}</p></div>
            {pct != null ? <Chip tone={marginTone(pct)}>{pct}%</Chip> : <Chip tone="mute">{has ? "Check costs" : "No recipe"}</Chip>}
          </button>; })}
        {products.length === 0 && <Empty icon={ChefHat} title="No dishes yet" text="Add a dish to your menu first, then build its recipe here." />}
      </div>
      <div className={product ? "" : "hidden lg:block"}>
        {product ? <RecipeEditor key={product.id} slug={slug} product={product} inventory={inventory} canEdit={canEdit} onBack={() => setProductId(null)} /> : <Empty icon={ChefHat} title="Pick a dish" text="Choose a dish on the left to build or edit its recipe." />}
      </div>
    </div>
  </Page>;
}

function RecipeEditor({ slug, product, inventory, canEdit, onBack }: { slug: string; product: any; inventory: any[]; canEdit: boolean; onBack: () => void }) {
  const router = useRouter();
  const existing = extractFnbRecipe(product.attributes);
  const [rows, setRows] = useState<Row[]>((existing?.ingredients || []).map((i) => ({ inventoryItemId: i.inventoryItemId, quantity: String(i.quantity), unit: i.unit })));
  const [yieldQty, setYieldQty] = useState(String(existing?.yieldQty || 1));
  const [busy, start] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [n, setN] = useState({ name: "", unit: "g", quantity: "", cost: "" });
  const isIng = (v: any) => v.product.isPublished === false;
  const options = inventory.filter((v) => v.productId !== product.id);
  const costOf = (id: string) => { const v = inventory.find((x) => x.id === id); if (!v) return null; return v.costPrice != null ? Number(v.costPrice) : isIng(v) ? Number(v.product.price) : null; };
  const yn = Number(yieldQty) > 0 ? Number(yieldQty) : 1;
  const lines = rows.map((r) => { const c = costOf(r.inventoryItemId); return c == null ? null : c * (Number(r.quantity) || 0); });
  const unknown = lines.some((l) => l == null);
  const perPortion = lines.reduce<number>((s, l) => s + (l ?? 0), 0) / yn;
  const price = Number(product.price) || 0;
  const margin = price - perPortion; const pct = price > 0 ? Math.round((margin / price) * 100) : 0;
  const update = (idx: number, patch: Partial<Row>) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const addRow = () => {
    if (options.length === 0) { setShowNew(true); toast.message("Create your first ingredient, then pick it here."); return; }
    const first = options.find((o) => isIng(o) && !rows.some((r) => r.inventoryItemId === o.id)) || options.find((o) => !rows.some((r) => r.inventoryItemId === o.id)) || options[0];
    setRows((p) => [...p, { inventoryItemId: first.id, quantity: "1", unit: "unit" }]);
  };
  const addNew = () => start(async () => {
    const r = await createFnbIngredient(slug, { name: n.name, unit: n.unit, quantity: Number(n.quantity || 0), costPerUnit: Number(n.cost) });
    if (!r.success) { toast.error(r.error); return; }
    toast.success(`${r.data.name} added`);
    setRows((p) => [...p, { inventoryItemId: r.data.inventoryItemId, quantity: "1", unit: n.unit.trim() || "unit" }]);
    setN({ name: "", unit: "g", quantity: "", cost: "" }); setShowNew(false); router.refresh();
  });
  const save = () => {
    if (!canEdit) return;
    const y = Number(yieldQty);
    if (!Number.isFinite(y) || y <= 0) { toast.error("Portions must be more than zero."); return; }
    const out = rows.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.quantity), unit: r.unit }));
    if (out.some((r) => !Number.isFinite(r.quantity) || r.quantity <= 0)) { toast.error("Every ingredient needs a quantity above zero."); return; }
    if (out.some((r) => !Number.isInteger(r.quantity))) { toast.error("Use whole numbers in your stock unit (200 g, not 0.2 kg)."); return; }
    if (new Set(out.map((r) => r.inventoryItemId)).size !== out.length) { toast.error("Each ingredient can only appear once."); return; }
    start(async () => { const r = await saveFnbRecipe(slug, product.id, { yieldQty: y, ingredients: out }); if (!r.success) toast.error(r.error); else { toast.success("Recipe saved"); router.refresh(); } });
  };
  const tone = marginTone(pct);
  return <div className="space-y-4">
    <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--bn-admin-muted)] lg:hidden"><ArrowLeft className="h-4 w-4" />All dishes</button>
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex items-center gap-3"><Avatar name={product.name} /><div className="min-w-0 flex-1"><h2 className="truncate text-base font-extrabold text-[var(--bn-admin-text-strong)]">{product.name}</h2><p className="text-xs text-[var(--bn-admin-muted)]">Sells for {money(price)}</p></div></div>
      {rows.length > 0 && <div className="mt-4 rounded-2xl p-4" style={toneStyle(unknown ? "mute" : tone)}>
        <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold opacity-80">You keep per portion</p><p className="text-2xl font-extrabold leading-tight">{unknown ? "—" : money(margin)}</p></div><div className="text-right"><p className="text-[11px] font-bold opacity-80">Food cost</p><p className="text-lg font-extrabold">{unknown ? "—" : money(perPortion)}</p></div></div>
        {!unknown && <div className="mt-3"><Meter value={pct} max={100} tone={tone} /><p className="mt-1.5 text-[11px] font-bold">{pct}% margin</p></div>}
        {unknown && <p className="mt-2 text-[11px]">Some ingredients have no cost yet. Set a cost per unit in Inventory to see your margin.</p>}
      </div>}
      <div className="mt-4 grid grid-cols-2 gap-3"><Field label="Portions this makes" hint="Quantities below are for the whole batch."><input disabled={!canEdit} type="number" inputMode="decimal" min="1" step="any" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} className={input} /></Field></div>
    </div>

    <Section title="Ingredients" hint="Selling this dish deducts these from stock." right={canEdit ? <button onClick={addRow} className={`${btnGhost} !min-h-9 !px-3 text-xs`}><Plus className="h-3.5 w-3.5" />Add</button> : undefined}>
      <div className="space-y-2.5">{rows.map((r, idx) => { const line = lines[idx]; return <div key={idx} className="rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] p-3">
        <select disabled={!canEdit} value={r.inventoryItemId} onChange={(e) => update(idx, { inventoryItemId: e.target.value })} className={input}>
          {options.some(isIng) && <optgroup label="Ingredients">{options.filter(isIng).map((v) => <option key={v.id} value={v.id}>{v.product.name}</option>)}</optgroup>}
          {options.some((v) => !isIng(v)) && <optgroup label="Menu items">{options.filter((v) => !isIng(v)).map((v) => <option key={v.id} value={v.id}>{v.product.name}</option>)}</optgroup>}
        </select>
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <input disabled={!canEdit} type="number" inputMode="numeric" min="1" step="1" placeholder="Qty" aria-label="Quantity" value={r.quantity} onChange={(e) => update(idx, { quantity: e.target.value })} className={input} />
          <input disabled={!canEdit} placeholder="g, ml, pcs" aria-label="Unit" value={r.unit} onChange={(e) => update(idx, { unit: e.target.value })} className={input} />
          <button type="button" aria-label="Remove ingredient" disabled={!canEdit} onClick={() => setRows((p) => p.filter((_, i) => i !== idx))} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--bn-admin-danger)]" style={toneStyle("bad")}><Trash2 className="h-4 w-4" /></button>
        </div>
        <p className="mt-1.5 text-right text-[11px] font-semibold text-[var(--bn-admin-muted)]">{line == null ? "No cost set" : `${money(line)} for the batch`}</p>
      </div>; })}
      {rows.length === 0 && <Empty icon={ChefHat} title="No ingredients yet" text={canEdit ? "Add what goes into this dish." : "Nothing configured."} action={canEdit ? <button onClick={addRow} className={btnPrimary}><Plus className="h-4 w-4" />Add ingredient</button> : undefined} />}</div>
      {canEdit && <div className="mt-3">
        <button type="button" onClick={() => setShowNew((v) => !v)} className="text-xs font-bold text-[var(--bn-admin-active)]">{showNew ? "Cancel" : "+ New ingredient (not sold on the menu)"}</button>
        {showNew && <div className="mt-3 grid grid-cols-2 gap-2.5 rounded-xl border border-[var(--bn-admin-border)] p-3">
          <div className="col-span-2"><Field label="Name"><input className={input} placeholder="e.g. Palm oil" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></Field></div>
          <Field label="Unit"><input className={input} placeholder="g, ml, pcs" value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })} /></Field>
          <Field label="In stock now"><input className={input} type="number" inputMode="numeric" min="0" value={n.quantity} onChange={(e) => setN({ ...n, quantity: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Cost per unit" hint="What one gram, ml or piece costs you."><input className={input} type="number" inputMode="decimal" min="0" step="any" value={n.cost} onChange={(e) => setN({ ...n, cost: e.target.value })} /></Field></div>
          <button type="button" disabled={busy} onClick={addNew} className={`${btnPrimary} col-span-2`}>{busy ? "Adding…" : "Add ingredient"}</button>
        </div>}
      </div>}
    </Section>
    {canEdit && <button type="button" disabled={busy} onClick={save} className={`${btnPrimary} w-full`}>{busy ? "Saving…" : "Save recipe"}</button>}
  </div>;
}
