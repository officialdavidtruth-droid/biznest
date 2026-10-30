"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { normalizeSearch } from "@/lib/geo";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  name?: string;
  onBlur?: () => void;
};

/**
 * Dropdown with a search box. Keyboard: ↑/↓ move, Enter selects, Esc closes,
 * typing filters (accent-insensitive). Prefix matches are ranked first.
 */
export function SearchableSelect({
  value, onChange, options, placeholder = "Select", searchPlaceholder = "Search…", emptyText = "No matches",
  disabled, loading, invalid, name, onBlur,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return options;
    const starts: string[] = [];
    const contains: string[] = [];
    for (const o of options) {
      const n = normalizeSearch(o);
      if (n.startsWith(q)) starts.push(o);
      else if (n.includes(q)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [options, query]);

  useEffect(() => { setActive(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const idx = filtered.indexOf(value);
    if (idx >= 0 && !query) setActive(idx);
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function close() {
    setOpen(false);
    setQuery("");
    onBlur?.();
  }

  function pick(v: string) {
    onChange(v);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[active]) pick(filtered[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  }

  return (
    <div ref={rootRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={`bv-input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${invalid ? "!border-destructive" : ""}`}
      >
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</li>
            ) : (
              filtered.map((o, i) => (
                <li
                  key={o}
                  data-idx={i}
                  role="option"
                  aria-selected={o === value}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${i === active ? "bg-muted" : ""}`}
                >
                  <span className="truncate">{o}</span>
                  {o === value && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={3} />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
