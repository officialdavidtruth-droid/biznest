"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Layers3, Minus, Plus, Trash2 } from "lucide-react";
import { setVariantOptions, updateVariant, deleteVariant } from "@/lib/actions/variant";

type MenuItem = { id: string; name: string; hasVariants: boolean; variantOptions: { name: string; values: string[] }[] | null };
type Variant = {
  id: string;
  label: string;
  optionValues: Record<string, string>;
  sku: string | null;
  price: string | null;
  quantity: number;
  isActive: boolean;
};

export function VariantManager({
  slug,
  products,
  initialVariantsByProduct,
}: {
  slug: string;
  products: MenuItem[];
  initialVariantsByProduct: Record<string, Variant[]>;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [variantsByProduct, setVariantsByProduct] = useState(initialVariantsByProduct);
  const [busy, setBusy] = useState(false);

  const product = products.find((p) => p.id === productId);
  const variants = variantsByProduct[productId] ?? [];

  const [options, setOptions] = useState<{ name: string; values: string }[]>(
    product?.variantOptions?.map((o) => ({ name: o.name, values: o.values.join(", ") })) ?? [{ name: "", values: "" }]
  );

  function switchProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    setOptions(p?.variantOptions?.map((o) => ({ name: o.name, values: o.values.join(", ") })) ?? [{ name: "", values: "" }]);
  }

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

  async function saveOptions(e: React.FormEvent) {
    e.preventDefault();
    const parsed = options
      .filter((o) => o.name.trim() && o.values.trim())
      .map((o) => ({ name: o.name.trim(), values: o.values.split(",").map((v) => v.trim()).filter(Boolean) }));
    if (parsed.length === 0) return toast.error("Add at least one option, e.g. \"Size\" with values \"Regular, Large\".");
    const result = await run(() => setVariantOptions(slug, productId, parsed), "Variants updated");
    if (result?.success) window.location.reload();
  }

  async function saveVariant(v: Variant, patch: Partial<{ price: string; sku: string; quantity: number; isActive: boolean }>) {
    const next = { ...v, ...patch };
    const result = await run(
      () =>
        updateVariant(slug, v.id, {
          optionValues: next.optionValues,
          sku: next.sku ?? "",
          barcode: "",
          price: next.price ? Number(next.price) : "",
          quantity: next.quantity,
          lowStockThreshold: 5,
          isActive: next.isActive,
        } as any),
      "Variant saved"
    );
    if (result?.success) {
      setVariantsByProduct((prev) => ({ ...prev, [productId]: (prev[productId] ?? []).map((x) => (x.id === v.id ? next : x)) }));
    }
  }

  async function removeVariant(id: string) {
    if (!window.confirm("Delete this variant?")) return;
    const result = await run(() => deleteVariant(slug, id), "Variant removed");
    if (result?.success) {
      setVariantsByProduct((prev) => ({ ...prev, [productId]: (prev[productId] ?? []).filter((x) => x.id !== id) }));
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold">Menu Items</h3>
        <ul className="space-y-1">
          {products.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => switchProduct(p.id)}
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
            <Layers3 className="h-4 w-4" /> Variant Options
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            e.g. "Size" with values "Regular, Large, Family" — every combination becomes its own variant with its own price and stock.
          </p>
          <form onSubmit={saveOptions} className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt.name}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, name: e.target.value } : o)))}
                  placeholder="Option name, e.g. Size"
                  className="w-40 rounded-lg border px-3 py-2 text-sm"
                />
                <input
                  value={opt.values}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, values: e.target.value } : o)))}
                  placeholder="Values, comma separated"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} className="rounded-lg border px-2 text-muted-foreground hover:bg-muted">
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => setOptions((prev) => [...prev, { name: "", values: "" }])} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> Add option
              </button>
              <button disabled={busy || !productId} type="submit" className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
                Save & Generate Variants
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold">Variants</h3>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No variants yet — set up options above.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Variant</th>
                    <th className="px-3 py-2">Price Override (₦)</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Active</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{v.label}</td>
                      <td className="px-3 py-2">
                        <input
                          defaultValue={v.price ?? ""}
                          onBlur={(e) => saveVariant(v, { price: e.target.value })}
                          placeholder="Use item price"
                          className="w-28 rounded-lg border px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          defaultValue={v.quantity}
                          onBlur={(e) => saveVariant(v, { quantity: Number(e.target.value) || 0 })}
                          className="w-20 rounded-lg border px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={v.isActive} onChange={(e) => saveVariant(v, { isActive: e.target.checked })} />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeVariant(v.id)} className="text-rose-500 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
