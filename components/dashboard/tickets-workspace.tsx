"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGuests, addTicketTier, createTicketEvent, recordTicketSale, scanTicket, setTicketEventStatus, updateTicketTier, voidTicket,
} from "@/lib/actions/tickets";
import { TICKET_PAYMENT_METHODS } from "@/lib/tickets";
import type { TicketsWorkspaceData } from "@/lib/tickets-data";

type Result = { success: boolean; error?: string };
type Ev = TicketsWorkspaceData["events"][number];

const ngn = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60";
const ghost = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60";
const label = (m: string) => m[0] + m.slice(1).toLowerCase();

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const run = (fn: () => Promise<Result>, ok?: string, after?: () => void) => {
    setError(""); setNote("");
    start(async () => {
      const r = await fn();
      if (!r.success) { setError(r.error ?? "Something went wrong."); return; }
      if (ok) setNote(ok);
      after?.();
      router.refresh();
    });
  };
  return { pending, error, note, run, setNote, setError };
}
function Msg({ error, note }: { error: string; note: string }) {
  if (error) return <p role="alert" className="text-xs text-red-600">{error}</p>;
  if (note) return <p role="status" className="text-xs text-emerald-700">{note}</p>;
  return null;
}
function Tile({ label: l, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

export function TicketsWorkspace({ slug, data, eventBase }: { slug: string; data: TicketsWorkspaceData; eventBase: string }) {
  const a = useAction();
  const [f, setF] = useState({ title: "", venue: "", startsAt: "", endsAt: "" });
  const [open, setOpen] = useState<string | null>(data.events[0]?.id ?? null);
  return (
    <div className="space-y-6">
      <form className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); a.run(() => createTicketEvent(slug, f), "Event created as a draft. Add ticket types, then publish.", () => setF({ title: "", venue: "", startsAt: "", endsAt: "" })); }}>
        <input className={input} placeholder="Event name" aria-label="Event name" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className={input} placeholder="Venue" aria-label="Venue" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} />
        <input className={input} type="datetime-local" aria-label="Starts" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
        <input className={input} type="datetime-local" aria-label="Ends (optional)" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
        <button className={btn} disabled={a.pending}>Create event</button>
        <div className="md:col-span-5"><Msg error={a.error} note={a.note} /></div>
      </form>
      {data.events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
      <ul className="space-y-3">
        {data.events.map((e) => (
          <li key={e.id} className="rounded-xl border bg-card">
            <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <span><b className="text-sm">{e.title}</b><span className="block text-xs text-muted-foreground">{when(e.startsAt)}{e.venue ? ` · ${e.venue}` : ""}</span></span>
              <span className="text-right text-xs"><b>{e.status}</b><span className="block text-muted-foreground">{e.tiers.reduce((s, t) => s + t.sold, 0)} / {e.tiers.reduce((s, t) => s + t.capacity, 0)} sold</span></span>
            </button>
            {open === e.id && <EventPanel slug={slug} e={e} eventBase={eventBase} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventPanel({ slug, e, eventBase }: { slug: string; e: Ev; eventBase: string }) {
  const a = useAction();
  const [view, setView] = useState<"tiers" | "gate" | "sell" | "guests" | "list">("tiers");
  const sold = e.tiers.reduce((s, t) => s + t.sold, 0);
  const url = `${eventBase}${e.slug}`;
  return (
    <div className="space-y-4 border-t p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Tickets sold" value={String(sold)} />
        <Tile label="Revenue" value={ngn(e.revenue)} />
        <Tile label="Checked in" value={String(e.checkedIn)} />
        <Tile label="Status" value={e.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly className={`${input} max-w-sm`} value={url} aria-label="Event link" onFocus={(x) => x.currentTarget.select()} />
        {e.status !== "PUBLISHED" && <button className={btn} disabled={a.pending} onClick={() => a.run(() => setTicketEventStatus(slug, e.id, "PUBLISHED"), "Published.")}>Publish</button>}
        {e.status === "PUBLISHED" && <button className={ghost} disabled={a.pending} onClick={() => a.run(() => setTicketEventStatus(slug, e.id, "CLOSED"), "Sales closed.")}>Close sales</button>}
        {e.status !== "CANCELLED" && <button className={ghost} disabled={a.pending} onClick={() => confirm("Cancel this event? Buyers are not refunded automatically.") && a.run(() => setTicketEventStatus(slug, e.id, "CANCELLED"))}>Cancel event</button>}
      </div>
      <Msg error={a.error} note={a.note} />
      <div className="flex flex-wrap gap-2" role="tablist">
        {([["tiers", "Ticket types"], ["gate", "Gate"], ["sell", "Door sale"], ["guests", "Guest list"], ["list", "All tickets"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${view === k ? "bg-primary text-primary-foreground" : "border"}`}>{l}</button>
        ))}
      </div>
      {view === "tiers" && <TiersView slug={slug} e={e} />}
      {view === "gate" && <GateView slug={slug} e={e} />}
      {view === "sell" && <SellView slug={slug} e={e} />}
      {view === "guests" && <GuestsView slug={slug} e={e} />}
      {view === "list" && <ListView slug={slug} e={e} />}
    </div>
  );
}

function TiersView({ slug, e }: { slug: string; e: Ev }) {
  const a = useAction();
  const [f, setF] = useState({ name: "", price: "", capacity: "", maxPerOrder: "10" });
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {e.tiers.map((t) => (
          <li key={t.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${t.active ? "" : "opacity-60"}`}>
            <span><b>{t.name}</b> <span className="text-xs text-muted-foreground">{t.price > 0 ? ngn(t.price) : "Free"} · {t.sold}/{t.capacity} · {t.state.replace("_", " ").toLowerCase()}</span></span>
            <button className={ghost} disabled={a.pending} onClick={() => a.run(() => updateTicketTier(slug, t.id, { name: t.name, price: t.price, capacity: t.capacity, maxPerOrder: t.maxPerOrder, saleEndsAt: t.saleEndsAt ?? undefined, active: !t.active }))}>{t.active ? "Turn off" : "Turn on"}</button>
          </li>
        ))}
      </ul>
      <form className="grid gap-2 md:grid-cols-5" onSubmit={(x) => { x.preventDefault(); a.run(() => addTicketTier(slug, e.id, { name: f.name, price: Number(f.price || 0), capacity: Number(f.capacity), maxPerOrder: Number(f.maxPerOrder || 10) }), "Added.", () => setF({ ...f, name: "", price: "", capacity: "" })); }}>
        <input className={input} placeholder="e.g. Regular, VIP" aria-label="Ticket type" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} />
        <input className={input} type="number" min="0" placeholder="Price (0 = free)" aria-label="Price" value={f.price} onChange={(x) => setF({ ...f, price: x.target.value })} />
        <input className={input} type="number" min="1" placeholder="How many" aria-label="Capacity" value={f.capacity} onChange={(x) => setF({ ...f, capacity: x.target.value })} />
        <input className={input} type="number" min="1" max="20" placeholder="Max per order" aria-label="Max per order" value={f.maxPerOrder} onChange={(x) => setF({ ...f, maxPerOrder: x.target.value })} />
        <button className={btn} disabled={a.pending}>Add type</button>
      </form>
      <Msg error={a.error} note={a.note} />
    </div>
  );
}

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function GateView({ slug, e }: { slug: string; e: Ev }) {
  const [code, setCode] = useState("");
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const router = useRouter();

  const submit = (raw: string) => {
    if (!raw.trim() || busy.current) return;
    busy.current = true;
    start(async () => {
      const r = await scanTicket(slug, e.id, raw);
      setLast(r.success ? { ok: r.data.admitted, text: r.data.message } : { ok: false, text: r.error ?? "Error" });
      setCode("");
      if (r.success && r.data.admitted) router.refresh();
      setTimeout(() => { busy.current = false; }, 1500);
    });
  };

  useEffect(() => {
    if (!camera) return;
    const Detect = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Detect || !navigator.mediaDevices?.getUserMedia) { setLast({ ok: false, text: "This browser can't scan with the camera. Type the code instead." }); setCamera(false); return; }
    const det = new Detect({ formats: ["qr_code"] });
    let stream: MediaStream | null = null, timer: ReturnType<typeof setInterval> | null = null, stopped = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      if (video.current) { video.current.srcObject = s; void video.current.play(); }
      timer = setInterval(async () => {
        if (!video.current || busy.current) return;
        try { const found = await det.detect(video.current); if (found[0]?.rawValue) submit(found[0].rawValue); } catch { /* keep trying */ }
      }, 500);
    }).catch(() => { setLast({ ok: false, text: "Camera permission was denied." }); setCamera(false); });
    return () => { stopped = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); submit(code); }}>
        <input className={input} autoFocus placeholder="Type or scan a ticket code" aria-label="Ticket code" value={code} onChange={(x) => setCode(x.target.value)} autoCapitalize="characters" autoComplete="off" />
        <button className={btn} disabled={pending}>Check</button>
        <button type="button" className={ghost} onClick={() => setCamera((c) => !c)}>{camera ? "Stop camera" : "Use camera"}</button>
      </form>
      {camera && <video ref={video} className="aspect-video w-full max-w-sm rounded-lg bg-black" muted playsInline />}
      {last && <p role="status" className={`rounded-xl p-4 text-lg font-bold ${last.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{last.ok ? "✓ " : "✗ "}{last.text}</p>}
      <p className="text-xs text-muted-foreground">{e.checkedIn} of {e.tickets.filter((t) => t.status !== "VOID").length} tickets checked in.</p>
    </div>
  );
}

function SellView({ slug, e }: { slug: string; e: Ev }) {
  const a = useAction();
  const tiers = e.tiers.filter((t) => t.active);
  const [f, setF] = useState({ tierId: tiers[0]?.id ?? "", qty: "1", name: "", email: "", method: "CASH" });
  return (
    <form className="grid gap-2 md:grid-cols-6" onSubmit={(x) => { x.preventDefault(); a.run(() => recordTicketSale(slug, { eventId: e.id, lines: [{ tierId: f.tierId, qty: Number(f.qty) }], name: f.name, email: f.email, method: f.method }), "Sold. Tickets are in the list.", () => setF({ ...f, name: "", email: "", qty: "1" })); }}>
      <select className={input} value={f.tierId} onChange={(x) => setF({ ...f, tierId: x.target.value })} aria-label="Ticket type">{tiers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.price > 0 ? ngn(t.price) : "Free"}</option>)}</select>
      <input className={input} type="number" min="1" aria-label="How many" value={f.qty} onChange={(x) => setF({ ...f, qty: x.target.value })} />
      <input className={input} placeholder="Buyer name" aria-label="Buyer name" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} />
      <input className={input} placeholder="Email (optional)" aria-label="Email" value={f.email} onChange={(x) => setF({ ...f, email: x.target.value })} />
      <select className={input} value={f.method} onChange={(x) => setF({ ...f, method: x.target.value })} aria-label="Paid by">{TICKET_PAYMENT_METHODS.filter((m) => m !== "COMP").map((m) => <option key={m} value={m}>{label(m)}</option>)}</select>
      <button className={btn} disabled={a.pending}>Sell</button>
      <div className="md:col-span-6"><Msg error={a.error} note={a.note} /></div>
    </form>
  );
}

function GuestsView({ slug, e }: { slug: string; e: Ev }) {
  const a = useAction();
  const tiers = e.tiers.filter((t) => t.active);
  const [tierId, setTierId] = useState(tiers[0]?.id ?? "");
  const [text, setText] = useState("");
  return (
    <form className="space-y-2" onSubmit={(x) => { x.preventDefault(); a.run(() => addGuests(slug, e.id, tierId, text), "Guests added.", () => setText("")); }}>
      <p className="text-xs text-muted-foreground">One guest per line: a name, or a name and email (they get their ticket by email). Each gets a free ticket.</p>
      <select className={input} value={tierId} onChange={(x) => setTierId(x.target.value)} aria-label="Ticket type">{tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <textarea className={input} rows={5} placeholder={"Ada Obi\nTunde Bello, tunde@example.com"} aria-label="Guests" value={text} onChange={(x) => setText(x.target.value)} />
      <button className={btn} disabled={a.pending || !tierId}>Add guests</button>
      <Msg error={a.error} note={a.note} />
    </form>
  );
}

function ListView({ slug, e }: { slug: string; e: Ev }) {
  const a = useAction();
  const [q, setQ] = useState("");
  const rows = e.tickets.filter((t) => !q || `${t.holder} ${t.buyer} ${t.email ?? ""} ${t.code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-2">
      <input className={input} placeholder="Search name, email or code" aria-label="Search tickets" value={q} onChange={(x) => setQ(x.target.value)} />
      <Msg error={a.error} note={a.note} />
      <ul className="space-y-1 text-sm">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
            <span>{t.holder} <span className="text-xs text-muted-foreground">· {t.tier} · {t.code}{t.receiptNo ? ` · ${t.receiptNo}` : ""}</span></span>
            <span className="flex items-center gap-2 text-xs">
              <b className={t.status === "CHECKED_IN" ? "text-emerald-700" : t.status === "VOID" ? "text-red-600" : ""}>{t.status === "CHECKED_IN" ? "In" : t.status === "VOID" ? "Cancelled" : "Valid"}</b>
              {t.status === "VALID" && <button className={ghost} disabled={a.pending} onClick={() => confirm("Cancel this ticket?") && a.run(() => voidTicket(slug, t.id))}>Cancel</button>}
            </span>
          </li>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted-foreground">No tickets.</p>}
      </ul>
    </div>
  );
}
