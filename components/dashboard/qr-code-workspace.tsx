"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download, Link2, Printer, QrCode, Search } from "lucide-react";
import type { QrCodesData, QrTarget } from "@/lib/actions/qr-codes";

type Mode = "store" | "catalog" | "category" | "product" | "service";
type Level = "L" | "M" | "Q" | "H";

const MODES: { id: Mode; label: string }[] = [
  { id: "store", label: "Store" },
  { id: "catalog", label: "Catalog" },
  { id: "category", label: "Categories" },
  { id: "product", label: "Products" },
  { id: "service", label: "Services" },
];

function fileSafe(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "qr-code";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function QrCodeWorkspace({ data }: { data: QrCodesData }) {
  const [mode, setMode] = useState<Mode>("store");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [level, setLevel] = useState<Level>("M");
  const [size, setSize] = useState(512);
  const [showLabel, setShowLabel] = useState(true);
  const [preview, setPreview] = useState<string>("");
  const [bulk, setBulk] = useState<Set<string>>(new Set());

  const list: QrTarget[] = useMemo(() => {
    const source = mode === "category" ? data.categories : mode === "product" ? data.products : mode === "service" ? data.services : [];
    const q = query.trim().toLowerCase();
    return q ? source.filter((t) => t.name.toLowerCase().includes(q)) : source;
  }, [mode, query, data]);

  const selected = list.find((t) => t.id === selectedId) ?? null;

  // What the single-QR preview points at, and what it's called.
  const target = useMemo(() => {
    if (mode === "store") return { url: data.storeUrl, label: data.storeName };
    if (mode === "catalog") return { url: data.catalogUrl, label: `${data.storeName} catalog` };
    if (selected) return { url: selected.url, label: selected.name };
    return null;
  }, [mode, selected, data]);

  const opts = useCallback(
    (width: number) => ({ width, margin: 2, errorCorrectionLevel: level, color: { dark: fg, light: bg } }),
    [level, fg, bg]
  );

  useEffect(() => {
    let cancelled = false;
    if (!target) {
      setPreview("");
      return;
    }
    QRCode.toDataURL(target.url, opts(320))
      .then((url) => !cancelled && setPreview(url))
      .catch(() => !cancelled && setPreview(""));
    return () => {
      cancelled = true;
    };
  }, [target, opts]);

  async function downloadPng() {
    if (!target) return;
    try {
      const url = await QRCode.toDataURL(target.url, opts(size));
      download(url, `${fileSafe(target.label)}-qr.png`);
    } catch {
      toast.error("Couldn't create the QR code. Please try again.");
    }
  }

  async function downloadSvg() {
    if (!target) return;
    try {
      const svg = await QRCode.toString(target.url, { type: "svg", margin: 2, errorCorrectionLevel: level, color: { dark: fg, light: bg } });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const href = URL.createObjectURL(blob);
      download(href, `${fileSafe(target.label)}-qr.svg`);
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      toast.error("Couldn't create the SVG. Please try again.");
    }
  }

  async function copyLink() {
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  function toggleBulk(id: string) {
    setBulk((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function printSheet() {
    const items: { label: string; url: string }[] = [];
    if (mode === "store" || mode === "catalog") {
      if (target) items.push(target);
    } else {
      for (const t of list) if (bulk.has(t.id)) items.push({ label: t.name, url: t.url });
    }
    if (items.length === 0) {
      toast.error(mode === "store" || mode === "catalog" ? "Nothing to print." : "Tick at least one item to print.");
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Allow pop-ups for this site to print the sheet.");
      return;
    }
    try {
      const cards = await Promise.all(
        items.map(async (i) => {
          const img = await QRCode.toDataURL(i.url, opts(480));
          return `<figure><img src="${img}" alt="" />${showLabel ? `<figcaption>${escapeHtml(i.label)}</figcaption>` : ""}</figure>`;
        })
      );
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.storeName)} QR codes</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#111}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}
  figure{margin:0;border:1px dashed #bbb;border-radius:12px;padding:14px;text-align:center;break-inside:avoid}
  img{width:100%;max-width:200px;height:auto}
  figcaption{margin-top:8px;font-size:14px;font-weight:600;word-break:break-word}
  @media print{body{margin:10mm}}
</style></head><body><div class="grid">${cards.join("")}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
      w.document.close();
    } catch {
      w.close();
      toast.error("Couldn't build the print sheet.");
    }
  }

  const isItemMode = mode === "category" || mode === "product" || mode === "service";
  const bulkCount = list.filter((t) => bulk.has(t.id)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">QR Codes</h1>
          <p className="text-sm text-muted-foreground">
            Make scannable codes for your store, catalog, categories, products and services. Print them on menus, shelf tags, flyers or packaging.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              setSelectedId(null);
              setQuery("");
            }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${mode === m.id ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border bg-background p-4">
          {isItemMode ? (
            <>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${mode === "category" ? "categories" : mode === "product" ? "products" : "services"}…`}
                  className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm"
                />
              </div>
              {data.truncated && <p className="mb-2 text-xs text-muted-foreground">Showing the first 500 of each type. Use search to find the rest.</p>}
              <div className="max-h-[28rem] divide-y overflow-y-auto rounded-xl border">
                {list.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nothing to show yet. Only published items get a QR code.</p>}
                {list.map((t) => (
                  <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${selectedId === t.id ? "bg-primary/5" : ""}`}>
                    <input type="checkbox" checked={bulk.has(t.id)} onChange={() => toggleBulk(t.id)} aria-label={`Select ${t.name} for the print sheet`} />
                    <button onClick={() => setSelectedId(t.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t.image ? <img src={t.image} alt="" className="h-9 w-9 shrink-0 rounded-lg border object-cover" /> : <div className="h-9 w-9 shrink-0 rounded-lg border bg-muted" />}
                      <span className="truncate text-sm font-medium">{t.name}</span>
                    </button>
                  </div>
                ))}
              </div>
              {list.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <button onClick={() => setBulk(new Set([...bulk, ...list.map((t) => t.id)]))} className="font-semibold text-primary">
                    Select all shown
                  </button>
                  <button onClick={() => setBulk(new Set())} className="text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                  <span className="text-muted-foreground">{bulkCount} selected</span>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 py-6 text-center">
              <Link2 className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-semibold">{mode === "store" ? "Your storefront" : "Your full catalog"}</p>
              <p className="break-all text-xs text-muted-foreground">{target?.url}</p>
            </div>
          )}
        </section>

        <aside className="space-y-4 rounded-2xl border bg-background p-4">
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border bg-muted/30 p-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={`QR code for ${target?.label ?? ""}`} className="h-auto w-full max-w-[320px]" />
            ) : (
              <p className="px-6 text-center text-sm text-muted-foreground">{isItemMode ? "Pick an item to preview its QR code." : "Generating…"}</p>
            )}
          </div>
          {target && <p className="truncate text-center text-xs text-muted-foreground" title={target.url}>{target.label}</p>}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="font-medium">Code colour</span>
              <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-9 w-full rounded-lg border" />
            </label>
            <label className="space-y-1">
              <span className="font-medium">Background</span>
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-full rounded-lg border" />
            </label>
            <label className="space-y-1">
              <span className="font-medium">Download size</span>
              <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-9 w-full rounded-lg border bg-background px-2">
                <option value={256}>256 px</option>
                <option value={512}>512 px</option>
                <option value={1024}>1024 px</option>
                <option value={2048}>2048 px (print)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-medium">Error correction</span>
              <select value={level} onChange={(e) => setLevel(e.target.value as Level)} className="h-9 w-full rounded-lg border bg-background px-2">
                <option value="L">Low</option>
                <option value="M">Medium</option>
                <option value="Q">Quartile</option>
                <option value="H">High</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)} /> Show names on the print sheet
          </label>
          <p className="text-[11px] text-muted-foreground">Keep strong contrast: a dark code on a light background scans most reliably.</p>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={downloadPng} disabled={!target} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              <Download className="h-4 w-4" /> PNG
            </button>
            <button onClick={downloadSvg} disabled={!target} className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">
              <Download className="h-4 w-4" /> SVG
            </button>
            <button onClick={copyLink} disabled={!target} className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">
              <Copy className="h-4 w-4" /> Copy link
            </button>
            <button onClick={printSheet} className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold">
              <Printer className="h-4 w-4" /> Print sheet
            </button>
          </div>
          {isItemMode && <p className="text-[11px] text-muted-foreground">Print sheet uses the items you tick on the left.</p>}
        </aside>
      </div>
    </div>
  );
}
