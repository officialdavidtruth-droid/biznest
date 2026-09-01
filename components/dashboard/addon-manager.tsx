"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Layers, Plus, Trash2 } from "lucide-react";
import {
  createAddon,
  createAddonGroup,
  deleteAddon,
  deleteAddonGroup,
  updateAddonGroup,
} from "@/lib/actions/addon";

type Addon = { id: string; name: string; price: string | number; isActive: boolean };
type Group = { id: string; name: string; minSelect: number; maxSelect: number | null; isActive: boolean; addons: Addon[] };
type MenuItem = { id: string; name: string };

function money(v: string | number) {
  return `₦${Number(v || 0).toLocaleString()}`;
}

export function AddonManager({
  slug,
  products,
  initialGroupsByProduct,
}: {
  slug: string;
  products: MenuItem[];
  initialGroupsByProduct: Record<string, Group[]>;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [groupsByProduct, setGroupsByProduct] = useState(initialGroupsByProduct);
  const [busy, setBusy] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [groupMin, setGroupMin] = useState("0");
  const [groupMax, setGroupMax] = useState("");

  const [addonDrafts, setAddonDrafts] = useState<Record<string, { name: string; price: string }>>({});

  const groups = groupsByProduct[productId] ?? [];

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

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return toast.error("Pick a menu item first.");
    const result = await run(
      () => createAddonGroup(slug, productId, { name: groupName, minSelect: Number(groupMin) || 0, maxSelect: groupMax ? Number(groupMax) : null }),
      "Add-on group created"
    );
    if (result?.success) {
      setGroupsByProduct((prev) => ({
        ...prev,
        [productId]: [...(prev[productId] ?? []), { id: result.data.id, name: groupName, minSelect: Number(groupMin) || 0, maxSelect: groupMax ? Number(groupMax) : null, isActive: true, addons: [] }],
      }));
      setGroupName("");
      setGroupMin("0");
      setGroupMax("");
    }
  }

  async function removeGroup(groupId: string) {
    if (!window.confirm("Delete this add-on group and all its options?")) return;
    const result = await run(() => deleteAddonGroup(slug, groupId), "Group deleted");
    if (result?.success) {
      setGroupsByProduct((prev) => ({ ...prev, [productId]: (prev[productId] ?? []).filter((g) => g.id !== groupId) }));
    }
  }

  async function toggleGroupActive(group: Group) {
    const result = await run(() => updateAddonGroup(slug, group.id, { isActive: !group.isActive }), "Updated");
    if (result?.success) {
      setGroupsByProduct((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? []).map((g) => (g.id === group.id ? { ...g, isActive: !g.isActive } : g)),
      }));
    }
  }

  async function addAddon(groupId: string) {
    const draft = addonDrafts[groupId];
    if (!draft?.name?.trim()) return toast.error("Give this option a name.");
    const result = await run(
      () => createAddon(slug, groupId, { name: draft.name, price: draft.price ? Number(draft.price) : 0 }),
      "Option added"
    );
    if (result?.success) {
      setGroupsByProduct((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? []).map((g) =>
          g.id === groupId ? { ...g, addons: [...g.addons, { id: result.data.id, name: draft.name, price: draft.price ? Number(draft.price) : 0, isActive: true }] } : g
        ),
      }));
      setAddonDrafts((prev) => ({ ...prev, [groupId]: { name: "", price: "" } }));
    }
  }

  async function removeAddon(groupId: string, addonId: string) {
    const result = await run(() => deleteAddon(slug, addonId), "Option removed");
    if (result?.success) {
      setGroupsByProduct((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? []).map((g) => (g.id === groupId ? { ...g, addons: g.addons.filter((a) => a.id !== addonId) } : g)),
      }));
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold">Menu Items</h3>
        {products.length === 0 && <p className="text-sm text-muted-foreground">Add menu items first.</p>}
        <ul className="space-y-1">
          {products.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setProductId(p.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${productId === p.id ? "bg-orange-500 text-white" : "hover:bg-muted"}`}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="space-y-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Layers className="h-4 w-4" /> New Add-on Group
          </h3>
          <form onSubmit={addGroup} className="flex flex-wrap items-end gap-2">
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder='e.g. "Choose your side"' className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm" />
            <input type="number" min={0} value={groupMin} onChange={(e) => setGroupMin(e.target.value)} placeholder="Min select" className="w-28 rounded-lg border px-3 py-2 text-sm" />
            <input type="number" min={0} value={groupMax} onChange={(e) => setGroupMax(e.target.value)} placeholder="Max select" className="w-28 rounded-lg border px-3 py-2 text-sm" />
            <button disabled={busy} type="submit" className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600">
              <Plus className="h-4 w-4" /> Add Group
            </button>
          </form>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
            No add-on groups for this item yet — create one above (e.g. "Extra toppings", "Choose your spice level").
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.minSelect > 0 ? `Required · pick ${group.minSelect}${group.maxSelect ? `–${group.maxSelect}` : "+"}` : `Optional${group.maxSelect ? ` · up to ${group.maxSelect}` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input type="checkbox" checked={group.isActive} onChange={() => toggleGroupActive(group)} /> Active
                  </label>
                  <button onClick={() => removeGroup(group.id)} className="text-rose-500 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <ul className="mb-3 space-y-1.5">
                {group.addons.map((addon) => (
                  <li key={addon.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span>{addon.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{Number(addon.price) > 0 ? `+${money(addon.price)}` : "Free"}</span>
                      <button onClick={() => removeAddon(group.id, addon.id)} className="text-rose-500 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {group.addons.length === 0 && <li className="text-xs text-muted-foreground">No options yet.</li>}
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={addonDrafts[group.id]?.name ?? ""}
                  onChange={(e) => setAddonDrafts((prev) => ({ ...prev, [group.id]: { name: e.target.value, price: prev[group.id]?.price ?? "" } }))}
                  placeholder="Option name, e.g. Extra cheese"
                  className="min-w-[180px] flex-1 rounded-lg border px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={addonDrafts[group.id]?.price ?? ""}
                  onChange={(e) => setAddonDrafts((prev) => ({ ...prev, [group.id]: { name: prev[group.id]?.name ?? "", price: e.target.value } }))}
                  placeholder="Extra price (₦)"
                  className="w-32 rounded-lg border px-3 py-2 text-sm"
                />
                <button disabled={busy} onClick={() => addAddon(group.id)} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
                  Add Option
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
