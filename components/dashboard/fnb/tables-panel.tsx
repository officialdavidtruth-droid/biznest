"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { Download, Plus, Printer, QrCode, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { createFnbTables, getFnbTables, removeFnbTable } from "@/lib/actions/fnb";
import { Empty, Field, Page, btnGhost, btnPrimary, card, input } from "./ui";

type Table = { id: string; name: string; seats: number | null; token: string };

function TableQr({ url, name }: { url: string; name: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then(setSrc).catch(() => setSrc("")); }, [url]);
  if (!src) return <div className="aspect-square w-full animate-pulse rounded-xl bg-[var(--bn-admin-surface-2)]" />;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`QR code for ${name}`} className="aspect-square w-full rounded-xl bg-white p-2" />
      <a href={src} download={`${name.replace(/\s+/g, "-").toLowerCase()}-qr.png`} className={`${btnGhost} mt-2 w-full text-xs`}><Download className="h-4 w-4" />Download</a>
    </>
  );
}

export function FnbTablesPanel({ slug }: { slug: string }) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [bulk, setBulk] = useState("");
  const [busy, start] = useTransition();

  const load = useCallback(async () => {
    const r = await getFnbTables(slug);
    if (!r.success) { toast.error(r.error); return; }
    setTables(r.data.tables); setBaseUrl(r.data.baseUrl);
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createFnbTables(slug, { name, seats: seats ? Number(seats) : null });
      if (!r.success) { toast.error(r.error); return; }
      setName(""); setSeats(""); toast.success("Table added."); load();
    });
  };
  const addMany = () => {
    const count = Number(bulk);
    if (!count || count < 2) return toast.error("Enter how many tables to add, like 10.");
    start(async () => {
      const r = await createFnbTables(slug, { count, seats: seats ? Number(seats) : null });
      if (!r.success) { toast.error(r.error); return; }
      setBulk(""); toast.success(`${r.data.created} tables added.`); load();
    });
  };
  const remove = (t: Table) => {
    if (!window.confirm(`Remove ${t.name}? Its QR code will stop working.`)) return;
    start(async () => { const r = await removeFnbTable(slug, t.id); if (!r.success) { toast.error(r.error); return; } load(); });
  };

  return (
    <Page title="Tables" sub="List your tables once. The register picks from this list, and each table's QR code tells you which table an order came from.">
      <form onSubmit={add} className={`${card} space-y-3 p-4`}>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><Field label="Table name"><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Table 1, Patio 2, VIP…" maxLength={40} /></Field></div>
          <Field label="Seats"><input className={input} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))} placeholder="4" /></Field>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button className={btnPrimary} disabled={busy || !name.trim()}><Plus className="h-4 w-4" />Add table</button>
          <div className="ml-auto flex items-end gap-2">
            <input className={`${input} w-24`} inputMode="numeric" value={bulk} onChange={(e) => setBulk(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 10" aria-label="Number of tables to add at once" />
            <button type="button" onClick={addMany} disabled={busy} className={btnGhost}>Add many</button>
          </div>
        </div>
      </form>

      {tables === null ? <div className="h-40 animate-pulse rounded-2xl bg-[var(--bn-admin-surface-2)]" /> : tables.length === 0 ? (
        <Empty icon={QrCode} title="No tables yet" text="Add your first table above. Each one gets its own QR code to print and place on the table." />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--bn-admin-text-strong)]">{tables.length} {tables.length === 1 ? "table" : "tables"}</p>
            <button onClick={() => window.print()} className={btnGhost}><Printer className="h-4 w-4" />Print QR codes</button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 print:grid-cols-3">
            {tables.map((t) => (
              <div key={t.id} className={`${card} p-3 print:break-inside-avoid`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[var(--bn-admin-text-strong)]">{t.name}</p>
                    {t.seats ? <p className="flex items-center gap-1 text-[11px] text-[var(--bn-admin-muted)]"><Users className="h-3 w-3" />{t.seats} seats</p> : null}
                  </div>
                  <button onClick={() => remove(t)} aria-label={`Remove ${t.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--bn-admin-muted)] hover:bg-[var(--bn-admin-surface-2)] print:hidden"><Trash2 className="h-4 w-4" /></button>
                </div>
                <TableQr url={`${baseUrl}/table/${t.token}`} name={t.name} />
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--bn-admin-muted)]">Guests who scan a code land on your menu, and their order is tagged with the table.</p>
        </>
      )}
    </Page>
  );
}
