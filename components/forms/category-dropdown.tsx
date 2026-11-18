"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Category = { id: string; name: string; parentId: string | null };

/** One compact dropdown that lets you tick several categories and subcategories (like WordPress). */
export function CategoryDropdown({
  categories, selectedIds, onToggle, label,
}: {
  categories: Category[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const top = categories.filter((c) => !c.parentId);
  const kids = (id: string) => categories.filter((c) => c.parentId === id);
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  const summary = selectedIds.length === 0 ? `Select ${label.toLowerCase()}` : selectedIds.length <= 2 ? selectedIds.map(name).join(", ") : `${name(selectedIds[0])} +${selectedIds.length - 1} more`;

  const row = (c: Category, indent: boolean) => {
    const on = selectedIds.includes(c.id);
    return (
      <button
        key={c.id} type="button" role="option" aria-selected={on} onClick={() => onToggle(c.id)}
        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${indent ? "pl-7" : "font-semibold"}`}
      >
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : ""}`}>{on && <Check className="h-3 w-3" />}</span>
        <span className="truncate">{c.name}</span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="input flex w-full items-center justify-between gap-2 text-left">
        <span className={`truncate ${selectedIds.length ? "" : "text-muted-foreground"}`}>{summary}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-background p-1 shadow-lg">
          {top.length === 0 && <p className="p-2 text-xs text-muted-foreground">No {label.toLowerCase()}s yet. Add some under Categories.</p>}
          {top.map((c) => (
            <div key={c.id}>{row(c, false)}{kids(c.id).map((k) => row(k, true))}</div>
          ))}
        </div>
      )}
    </div>
  );
}
