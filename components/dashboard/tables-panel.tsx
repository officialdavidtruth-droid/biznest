"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { CalendarDays, Download, Plus, Printer, QrCode, Settings2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { createStoreTables, getStoreTables, removeStoreTable } from "@/lib/actions/tables";
import { getReservationsAdmin, saveReservationSettings, setReservationStatus } from "@/lib/actions/table-reservations";
import { timeLabel, type ReservationConfig } from "@/lib/table-reservations";
import { Chip, Empty, Field, Page, Section, btnGhost, btnPrimary, card, input } from "@/components/dashboard/fnb/ui";

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

export function TablesPanel({ slug }: { slug: string }) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [bulk, setBulk] = useState("");
  const [busy, start] = useTransition();

  const load = useCallback(async () => {
    const r = await getStoreTables(slug);
    if (!r.success) { toast.error(r.error); return; }
    setTables(r.data.tables); setBaseUrl(r.data.baseUrl);
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createStoreTables(slug, { name, seats: seats ? Number(seats) : null });
      if (!r.success) { toast.error(r.error); return; }
      setName(""); setSeats(""); toast.success("Table added."); load();
    });
  };
  const addMany = () => {
    const count = Number(bulk);
    if (!count || count < 2) return toast.error("Enter how many tables to add, like 10.");
    start(async () => {
      const r = await createStoreTables(slug, { count, seats: seats ? Number(seats) : null });
      if (!r.success) { toast.error(r.error); return; }
      setBulk(""); toast.success(`${r.data.created} tables added.`); load();
    });
  };
  const remove = (t: Table) => {
    if (!window.confirm(`Remove ${t.name}? Its QR code will stop working.`)) return;
    start(async () => { const r = await removeStoreTable(slug, t.id); if (!r.success) { toast.error(r.error); return; } load(); });
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
      <ReservationsSection slug={slug} />
    </Page>
  );
}

type Res = { id: string; code: string; guestName: string; phone: string; partySize: number; startsAt: Date | string; status: string; notes: string | null; tableName: string | null };

function hhmm(d: Date | string) { const x = new Date(d); return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; }

export function ReservationsSection({ slug }: { slug: string }) {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<Res[] | null>(null);
  const [cfg, setCfg] = useState<ReservationConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, start] = useTransition();

  const load = useCallback(async (d?: string) => {
    const r = await getReservationsAdmin(slug, d);
    if (!r.success) { toast.error(r.error); return; }
    setDate(r.data.date); setRows(r.data.reservations); setCfg(r.data.cfg);
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const setStatus = (id: string, status: "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW") => start(async () => {
    const r = await setReservationStatus(slug, id, status);
    if (!r.success) { toast.error(r.error); return; }
    load(date);
  });
  const saveCfg = () => cfg && start(async () => {
    const r = await saveReservationSettings(slug, cfg);
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Reservation settings saved."); setShowSettings(false);
  });
  const tone = (s: string) => (s === "CONFIRMED" ? "info" : s === "SEATED" ? "ok" : s === "COMPLETED" ? "mute" : "bad") as any;
  const nice: Record<string, string> = { CONFIRMED: "Booked", SEATED: "Seated", COMPLETED: "Done", CANCELLED: "Cancelled", NO_SHOW: "No-show" };

  return (
    <Section title="Table reservations" hint="Guests book a date, time and party size on your storefront. The smallest free table that fits is held for them."
      right={<button onClick={() => setShowSettings((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--bn-admin-active)]"><Settings2 className="h-4 w-4" />Settings</button>}>
      {showSettings && cfg && (
        <div className="mb-4 space-y-3 rounded-xl bg-[var(--bn-admin-surface-2)] p-3">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />Accept online reservations</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens"><input type="time" className={input} value={cfg.open} onChange={(e) => setCfg({ ...cfg, open: e.target.value })} /></Field>
            <Field label="Closes"><input type="time" className={input} value={cfg.close} onChange={(e) => setCfg({ ...cfg, close: e.target.value })} /></Field>
            <Field label="Sitting length (min)"><input className={input} inputMode="numeric" value={cfg.durationMins} onChange={(e) => setCfg({ ...cfg, durationMins: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
            <Field label="Largest party"><input className={input} inputMode="numeric" value={cfg.maxParty} onChange={(e) => setCfg({ ...cfg, maxParty: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
            <Field label="Book up to (days ahead)"><input className={input} inputMode="numeric" value={cfg.daysAhead} onChange={(e) => setCfg({ ...cfg, daysAhead: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
            <Field label="Notice needed (min)"><input className={input} inputMode="numeric" value={cfg.leadMins} onChange={(e) => setCfg({ ...cfg, leadMins: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
          </div>
          <button onClick={saveCfg} disabled={busy} className={btnPrimary}>Save settings</button>
        </div>
      )}
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[var(--bn-admin-muted)]" />
        <input type="date" className={`${input} max-w-[11rem]`} value={date} onChange={(e) => e.target.value && load(e.target.value)} />
      </div>
      {rows === null ? <div className="h-24 animate-pulse rounded-xl bg-[var(--bn-admin-surface-2)]" /> : rows.length === 0 ? <p className="text-sm text-[var(--bn-admin-muted)]">No reservations for this day. Share your reservation link: <span className="font-semibold">/reserve</span> on your storefront.</p> : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.id} className={`${card} p-3`}>
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-16 shrink-0 place-items-center rounded-xl bg-[var(--bn-admin-surface-2)] text-sm font-extrabold">{timeLabel(hhmm(r.startsAt))}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--bn-admin-text-strong)]">{r.guestName} · {r.partySize} {r.partySize === 1 ? "guest" : "guests"}</p>
                  <p className="truncate text-[11px] text-[var(--bn-admin-muted)]">{r.tableName ?? "No table"} · <a href={`tel:${r.phone}`} className="underline">{r.phone}</a> · {r.code}</p>
                  {r.notes && <p className="mt-1 text-xs text-[var(--bn-admin-muted)]">{r.notes}</p>}
                </div>
                <Chip tone={tone(r.status)}>{nice[r.status] ?? r.status}</Chip>
              </div>
              {r.status === "CONFIRMED" && <div className="mt-2.5 flex flex-wrap gap-2"><button disabled={busy} onClick={() => setStatus(r.id, "SEATED")} className={btnPrimary}>Seat</button><button disabled={busy} onClick={() => setStatus(r.id, "NO_SHOW")} className={btnGhost}>No-show</button><button disabled={busy} onClick={() => setStatus(r.id, "CANCELLED")} className={btnGhost}>Cancel</button></div>}
              {r.status === "SEATED" && <div className="mt-2.5"><button disabled={busy} onClick={() => setStatus(r.id, "COMPLETED")} className={btnPrimary}>Mark done</button></div>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
