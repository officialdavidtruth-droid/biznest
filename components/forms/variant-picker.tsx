"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export type Axis = { name: string; values: string[] };

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const COLORS: Record<string, string> = {
  Black: "#111111", White: "#ffffff", Grey: "#9ca3af", Red: "#dc2626", Orange: "#f97316", Yellow: "#facc15", Green: "#16a34a",
  Blue: "#2563eb", Navy: "#1e3a8a", Purple: "#9333ea", Pink: "#ec4899", Brown: "#92400e", Beige: "#d6c3a3", Gold: "#ca8a04", Silver: "#cbd5e1",
};
const MAX_COMBOS = 200;

export function axesToOptions(axes: Axis[]): Axis[] {
  return axes.map((a) => ({ name: a.name.trim(), values: [...new Set(a.values.map((v) => v.trim()).filter(Boolean))] })).filter((a) => a.name && a.values.length);
}

/** Optional Size / Colour / custom option pickers for a product. Nothing here is required. */
export function VariantPicker({ axes, onChange }: { axes: Axis[]; onChange: (axes: Axis[]) => void }) {
  const get = (name: string) => axes.find((a) => a.name.toLowerCase() === name.toLowerCase())?.values ?? [];
  const setAxis = (name: string, values: string[]) => {
    const exists = axes.some((a) => a.name.toLowerCase() === name.toLowerCase());
    onChange(exists ? axes.map((a) => (a.name.toLowerCase() === name.toLowerCase() ? { ...a, values } : a)) : [...axes, { name, values }]);
  };
  const custom = axes.filter((a) => !["size", "color", "colour"].includes(a.name.toLowerCase()));
  const sizeName = axes.find((a) => a.name.toLowerCase() === "size")?.name ?? "Size";
  const colorName = axes.find((a) => ["color", "colour"].includes(a.name.toLowerCase()))?.name ?? "Color";
  const [newOption, setNewOption] = useState("");
  const combos = axesToOptions(axes).reduce((n, a) => n * a.values.length, 1);
  const active = axesToOptions(axes).length > 0;

  return (
    <div className="space-y-5">
      <Chips title="Sizes" name={sizeName} presets={SIZES.map((v) => ({ v }))} selected={get(sizeName)} onChange={(v) => setAxis(sizeName, v)} placeholder="Other sizes, e.g. 40, 41, 42" />
      <Chips title="Colours" name={colorName} presets={Object.entries(COLORS).map(([v, hex]) => ({ v, hex }))} selected={get(colorName)} onChange={(v) => setAxis(colorName, v)} placeholder="Other colours, e.g. Wine" />
      {custom.map((a) => (
        <Chips key={a.name} title={a.name} name={a.name} presets={[]} selected={a.values} onChange={(v) => setAxis(a.name, v)} placeholder={`Add ${a.name.toLowerCase()} values`} onRemove={() => onChange(axes.filter((x) => x.name !== a.name))} />
      ))}
      {axes.length < 3 && (
        <div className="flex gap-2">
          <input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Another option, e.g. Material or Storage" className="input flex-1" maxLength={40} />
          <button type="button" disabled={!newOption.trim()} onClick={() => { setAxis(newOption.trim(), []); setNewOption(""); }} className="rounded-lg border px-3 text-sm font-medium disabled:opacity-50">Add option</button>
        </div>
      )}
      {active && (
        <p className={`text-xs ${combos > MAX_COMBOS ? "text-destructive" : "text-muted-foreground"}`}>
          {combos > MAX_COMBOS ? `That makes ${combos} combinations. The limit is ${MAX_COMBOS}; remove some values.` : `This makes ${combos} ${combos === 1 ? "variant" : "variants"}. You set the stock and price for each one after saving.`}
        </p>
      )}
    </div>
  );
}

function Chips({ title, name, presets, selected, onChange, placeholder, onRemove }: {
  title: string; name: string; presets: { v: string; hex?: string }[]; selected: string[]; onChange: (v: string[]) => void; placeholder: string; onRemove?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const addDraft = () => {
    const vals = draft.split(",").map((x) => x.trim()).filter(Boolean).filter((x) => !selected.some((s) => s.toLowerCase() === x.toLowerCase()));
    if (vals.length) onChange([...selected, ...vals].slice(0, 30));
    setDraft("");
  };
  const extra = selected.filter((s) => !presets.some((p) => p.v === s));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between"><label className="text-sm font-medium" title={name}>{title}</label>{onRemove && <button type="button" onClick={onRemove} className="text-xs text-muted-foreground underline">Remove option</button>}</div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const on = selected.includes(p.v);
          return (
            <button key={p.v} type="button" aria-pressed={on} onClick={() => toggle(p.v)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              {p.hex && <span className="h-3 w-3 rounded-full border" style={{ background: p.hex }} />}{p.v}
            </button>
          );
        })}
        {extra.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{v}<button type="button" onClick={() => toggle(v)} aria-label={`Remove ${v}`}><X className="h-3 w-3" /></button></span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDraft(); } }} placeholder={placeholder} className="input flex-1" maxLength={120} />
        <button type="button" onClick={addDraft} disabled={!draft.trim()} className="inline-flex items-center gap-1 rounded-lg border px-3 text-sm disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Add</button>
      </div>
    </div>
  );
}
