"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteFinancialSheet, listFinancialSheets, saveFinancialSheet } from "@/lib/actions/financial-sheets";
import { getFinancialStatements, getStockValuation } from "@/lib/actions/financial-reports";
import { cellId, colName, displayValue, evaluateSheet, isErr, parseCellId, type Cells } from "@/lib/financial/sheet-engine";
import { toCsv } from "@/lib/financial/statements";
import { btnGhost, btnPrimary, card, download, field } from "@/components/dashboard/fin-ui";

const COLS = 12;
const MIN_ROWS = 30;

type Saved = { id: string; name: string; updatedAt: string; cells: Cells };

const TEMPLATES: Record<string, { label: string; cells: Cells }> = {
  breakeven: {
    label: "Break-even calculator",
    cells: {
      A1: "Break-even calculator", A3: "Selling price per unit", B3: "5000", A4: "Cost per unit", B4: "3000", A5: "Fixed costs per month", B5: "400000",
      A7: "Profit per unit", B7: "=B3-B4", A8: "Margin", B8: "=B7/B3", A9: "Units to break even", B9: "=ROUNDUP(B5/B7,0)", A10: "Sales needed (revenue)", B10: "=B9*B3",
      A12: "Target profit", B12: "200000", A13: "Units to hit target", B13: "=ROUNDUP((B5+B12)/B7,0)",
    },
  },
  loan: {
    label: "Loan repayment",
    cells: {
      A1: "Loan repayment", A3: "Amount borrowed", B3: "5000000", A4: "Yearly interest rate", B4: "18%", A5: "Number of months", B5: "24",
      A7: "Monthly payment", B7: "=-PMT(B4/12,B5,B3)", A8: "Total repaid", B8: "=B7*B5", A9: "Total interest", B9: "=B8-B3",
    },
  },
  budget: {
    label: "Monthly budget",
    cells: {
      A1: "Monthly budget", A3: "Item", B3: "Budget", C3: "Actual", D3: "Difference",
      A4: "Rent", B4: "150000", C4: "150000", D4: "=B4-C4", A5: "Salaries", B5: "300000", C5: "320000", D5: "=B5-C5", A6: "Marketing", B6: "50000", C6: "42000", D6: "=B6-C6",
      A7: "Utilities", B7: "40000", C7: "38000", D7: "=B7-C7", A9: "Total", B9: "=SUM(B4:B7)", C9: "=SUM(C4:C7)", D9: "=SUM(D4:D7)",
    },
  },
  blank: { label: "Blank sheet", cells: {} },
};

export function FinancialSheet({ slug }: { slug: string }) {
  const [sheets, setSheets] = useState<Saved[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled sheet");
  const [cells, setCells] = useState<Cells>({});
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState("A1");
  const [draft, setDraft] = useState<string | null>(null);
  const [rows, setRows] = useState(MIN_ROWS);
  const [busy, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    start(async () => {
      const res = await listFinancialSheets(slug);
      if (res.success) {
        setSheets(res.data);
        if (res.data[0]) open(res.data[0]);
      }
    });
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const values = useMemo(() => evaluateSheet(cells), [cells]);
  const maxRow = useMemo(() => Math.max(MIN_ROWS, rows, ...Object.keys(cells).map((k) => (parseCellId(k)?.row ?? 0) + 2)), [cells, rows]);

  function open(s: Saved) { setId(s.id); setName(s.name); setCells(s.cells ?? {}); setDirty(false); setSel("A1"); setDraft(null); }
  function load(cs: Cells, title: string) { setId(null); setName(title); setCells(cs); setDirty(true); setSel("A1"); setDraft(null); }

  const commit = (cellKey: string, raw: string) => {
    setCells((c) => { const n = { ...c }; if (raw === "") delete n[cellKey]; else n[cellKey] = raw; return n; });
    setDirty(true);
  };
  const move = (dc: number, dr: number) => {
    const p = parseCellId(sel)!;
    const next = cellId(Math.max(0, Math.min(COLS - 1, p.col + dc)), Math.max(0, p.row + dr));
    setSel(next); setDraft(null);
  };

  const save = () => start(async () => {
    const res = await saveFinancialSheet(slug, { id: id ?? undefined, name, cells });
    if (!res.success) { toast.error(res.error); return; }
    setId(res.data.id); setDirty(false);
    setSheets((list) => [{ id: res.data.id, name, updatedAt: res.data.updatedAt, cells }, ...list.filter((s) => s.id !== res.data.id)]);
    toast.success("Sheet saved");
  });
  const remove = () => {
    if (!id || !confirm(`Delete "${name}"?`)) return;
    start(async () => {
      const res = await deleteFinancialSheet(slug, id);
      if (!res.success) { toast.error(res.error); return; }
      setSheets((l) => l.filter((s) => s.id !== id)); load({}, "Untitled sheet"); setDirty(false);
    });
  };

  const importLedger = (kind: "pl" | "stock" | "tb") => start(async () => {
    const n = new Date();
    const from = `${n.getUTCFullYear()}-01-01`, to = n.toISOString().slice(0, 10);
    const out: Cells = {};
    if (kind === "stock") {
      const res = await getStockValuation(slug);
      if (!res.success) { toast.error(res.error); return; }
      ["Item", "Qty", "Unit cost", "Value at cost"].forEach((h, i) => (out[cellId(i, 0)] = h));
      res.data.rows.slice(0, 500).forEach((r, i) => { const row = i + 2; out[`A${row}`] = r.name; out[`B${row}`] = String(r.quantity); out[`C${row}`] = String(r.costPrice ?? 0); out[`D${row}`] = `=B${row}*C${row}`; });
      const last = Math.min(res.data.rows.length, 500) + 1;
      out[`A${last + 2}`] = "Total"; out[`B${last + 2}`] = `=SUM(B2:B${last})`; out[`D${last + 2}`] = `=SUM(D2:D${last})`;
      load(out, "Stock valuation");
    } else {
      const res = await getFinancialStatements(slug, from, to);
      if (!res.success) { toast.error(res.error); return; }
      if (kind === "pl") {
        const { pl } = res.data;
        let r = 1;
        out.A1 = `Profit & Loss, ${from} to ${to}`; r = 3;
        const put = (label: string, v: string) => { out[`A${r}`] = label; out[`B${r}`] = v; r++; };
        put("Revenue", String(pl.totals.revenue)); put("Cost of sales", String(pl.totals.costOfSales)); put("Gross profit", `=B3-B4`);
        put("Gross margin", `=IFERROR(B5/B3,0)`); r++;
        const exStart = r; pl.expenses.forEach((x) => put(x.name, String(x.amount)));
        const exEnd = r - 1; put("Total expenses", exEnd >= exStart ? `=SUM(B${exStart}:B${exEnd})` : "0"); put("Net profit", `=B5-B${r - 1}`);
        put("Net margin", `=IFERROR(B${r - 1}/B3,0)`);
        load(out, "Profit & Loss (year to date)");
      } else {
        const { tb } = res.data;
        ["Code", "Account", "Debit", "Credit"].forEach((h, i) => (out[cellId(i, 0)] = h));
        tb.rows.forEach((x, i) => { const row = i + 2; out[`A${row}`] = x.code; out[`B${row}`] = x.name; out[`C${row}`] = String(x.debit); out[`D${row}`] = String(x.credit); });
        const last = tb.rows.length + 1;
        out[`B${last + 2}`] = "Total"; out[`C${last + 2}`] = `=SUM(C2:C${last})`; out[`D${last + 2}`] = `=SUM(D2:D${last})`; out[`B${last + 3}`] = "Difference"; out[`C${last + 3}`] = `=C${last + 2}-D${last + 2}`;
        load(out, `Trial balance, ${to}`);
      }
    }
  });

  const exportCsv = () => {
    const keys = Object.keys(cells).map((k) => parseCellId(k)!);
    const maxR = Math.max(0, ...keys.map((k) => k.row)), maxC = Math.max(0, ...keys.map((k) => k.col));
    const grid: (string | number | null)[][] = [];
    for (let r = 0; r <= maxR; r++) { const line: (string | number | null)[] = []; for (let c = 0; c <= maxC; c++) { const v = values[cellId(c, r)]; line.push(v === undefined || v === "" ? null : isErr(v) ? v.error : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v); } grid.push(line); }
    download(`${name.replace(/[^\w-]+/g, "_")}.csv`, toCsv(grid));
  };

  const selValue = values[sel];
  const selRaw = cells[sel] ?? "";
  useEffect(() => {
    if (draft !== null) { inputRef.current?.focus(); return; }
    document.querySelector<HTMLElement>(`[data-cell="${sel}"]`)?.focus({ preventScroll: false });
  }, [sel, draft]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="text-xl font-bold">Spreadsheet</h2><p className="mt-1 text-sm text-[var(--bn-admin-muted)]">Type numbers or formulas like <code className="rounded bg-[var(--bn-admin-surface-2)] px-1.5 py-0.5 text-xs">=SUM(B2:B9)</code>. Pull in live figures from your books, then save.</p></div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Open a saved sheet" value={id ?? ""} onChange={(e) => { const s = sheets.find((x) => x.id === e.target.value); if (s) open(s); }} className={`${field} w-auto`}>
            <option value="">{sheets.length ? "Open a saved sheet…" : "No saved sheets yet"}</option>
            {sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select aria-label="Start from a template" value="" onChange={(e) => { const t = TEMPLATES[e.target.value]; if (t) load(t.cells, t.label); }} className={`${field} w-auto`}>
            <option value="">New from template…</option>
            {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} aria-label="Sheet name" className={`${field} w-56 font-bold`} />
        <button className={btnPrimary} onClick={save} disabled={busy || !dirty && !!id}><Save className="h-3.5 w-3.5" /> {dirty || !id ? "Save" : "Saved"}</button>
        <button className={btnGhost} onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Excel / CSV</button>
        <span className="mx-1 hidden h-5 w-px bg-[var(--bn-admin-border)] sm:block" />
        <span className="text-xs font-bold text-[var(--bn-admin-muted)]">Pull in:</span>
        <button className={btnGhost} onClick={() => importLedger("pl")} disabled={busy}>Profit & Loss</button>
        <button className={btnGhost} onClick={() => importLedger("tb")} disabled={busy}>Trial balance</button>
        <button className={btnGhost} onClick={() => importLedger("stock")} disabled={busy}>Stock list</button>
        {id && <button className={`${btnGhost} ml-auto text-rose-600`} onClick={remove} disabled={busy}><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
      </div>

      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 rounded-lg border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] px-2 py-2 text-center text-xs font-bold">{sel}</span>
        <input
          aria-label="Formula bar" value={draft ?? selRaw} placeholder="Type a value or =formula"
          onFocus={() => setDraft((d) => d ?? selRaw)} onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (draft !== null) { commit(sel, draft); setDraft(null); } }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft !== null) commit(sel, draft); setDraft(null); move(0, 1); } if (e.key === "Escape") setDraft(null); }}
          className={`${field} font-mono`}
        />
        {selRaw.startsWith("=") && <span className="shrink-0 text-xs font-bold text-[var(--bn-admin-muted)]">= {displayValue(selValue)}</span>}
      </div>

      <div className={`${card} max-h-[62vh] overflow-auto`}>
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--bn-admin-surface-2)]">
            <tr>
              <th className="sticky left-0 z-20 w-10 border-b border-r border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)]" />
              {Array.from({ length: COLS }, (_, c) => <th key={c} className="min-w-[110px] border-b border-r border-[var(--bn-admin-border)] px-2 py-1.5 text-xs font-bold text-[var(--bn-admin-muted)]">{colName(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRow }, (_, r) => (
              <tr key={r}>
                <th className="sticky left-0 z-[5] border-b border-r border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] px-2 py-1 text-center text-xs font-bold text-[var(--bn-admin-muted)]">{r + 1}</th>
                {Array.from({ length: COLS }, (_, c) => {
                  const k = cellId(c, r);
                  const v = values[k];
                  const isSel = k === sel;
                  const editing = isSel && draft !== null;
                  const numeric = typeof v === "number";
                  return (
                    <td
                      key={k}
                      onClick={() => { if (!isSel) { if (draft !== null) commit(sel, draft); setDraft(null); setSel(k); } }}
                      onDoubleClick={() => setDraft(cells[k] ?? "")}
                      className={`h-8 cursor-cell border-b border-r border-[var(--bn-admin-border)] p-0 ${isSel ? "outline outline-2 -outline-offset-2 outline-[var(--bn-admin-orange)]" : ""}`}
                    >
                      {editing ? (
                        <input
                          ref={inputRef} value={draft ?? ""} onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => { if (draft !== null) { commit(k, draft); setDraft(null); } }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commit(k, draft ?? ""); setDraft(null); move(0, 1); }
                            else if (e.key === "Tab") { e.preventDefault(); commit(k, draft ?? ""); setDraft(null); move(e.shiftKey ? -1 : 1, 0); }
                            else if (e.key === "Escape") setDraft(null);
                          }}
                          className="h-8 w-full bg-white px-2 font-mono text-sm text-black outline-none"
                        />
                      ) : (
                        <div
                          data-cell={k}
                          tabIndex={isSel ? 0 : -1}
                          onKeyDown={(e) => {
                            if (!isSel) return;
                            if (e.key === "ArrowDown") { e.preventDefault(); move(0, 1); }
                            else if (e.key === "ArrowUp") { e.preventDefault(); move(0, -1); }
                            else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1, 0); }
                            else if (e.key === "ArrowRight" || e.key === "Tab") { e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); }
                            else if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); setDraft(cells[k] ?? ""); }
                            else if (e.key === "Delete" || e.key === "Backspace") { commit(k, ""); }
                            else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setDraft(e.key); }
                          }}
                          className={`h-8 truncate px-2 py-1.5 outline-none ${numeric ? "text-right tabular-nums" : ""} ${isErr(v) ? "text-rose-600" : ""}`}
                        >{displayValue(v)}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--bn-admin-muted)]">
        <span>Functions: SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS, IF, AND, OR, IFERROR, SUMIF, COUNTIF, PMT, NPV, POWER, SQRT, MOD</span>
        <button className="inline-flex items-center gap-1 font-bold text-[var(--bn-admin-orange)]" onClick={() => setRows((r) => r + 20)}><Plus className="h-3 w-3" /> More rows</button>
      </div>
    </div>
  );
}
