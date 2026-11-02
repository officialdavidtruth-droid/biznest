// Client-facing PDF documents for BizNest Travel: quote, invoice and day-by-day itinerary.
// Pure builder: takes plain data, returns PDF bytes. No database or auth in here so it is easy to test.
// Cost prices, margins, supplier names, passport numbers and internal notes are never printed.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatNumber } from "@/lib/i18n/locale";
import { netReceived } from "@/lib/travel";

export const TRAVEL_DOC_KINDS = ["quote", "invoice", "itinerary"] as const;
export type TravelDocKind = (typeof TRAVEL_DOC_KINDS)[number];

export type TravelDocInput = {
  kind: TravelDocKind;
  store: { name: string; contactEmail?: string | null; contactPhone?: string | null; whatsappNumber?: string | null };
  trip: { reference: string; title: string; destination: string; departDate?: Date | null; returnDate?: Date | null; currency: string; totalPrice: number };
  client: { fullName: string; email?: string | null; phone?: string | null };
  travellers: { fullName: string; isLead?: boolean }[];
  items: { kind: string; description: string; startDate?: Date | null; endDate?: Date | null; confirmationRef?: string | null; status: string; sellPrice: number }[];
  payments: { amount: number; status: string; method: string; paidAt?: Date | null; dueDate?: Date | null; reference?: string | null; refundedAmount?: number }[];
  locale?: string | null;
  now?: Date;
};

const KIND_LABEL: Record<string, string> = {
  FLIGHT: "Flight", HOTEL: "Hotel", TRANSFER: "Transfer", TOUR: "Tour", VISA: "Visa", INSURANCE: "Insurance", OTHER: "Service",
};

const dateFmt = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d) : "";
const longDateFmt = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Group dated service lines by start day. Lines without a date come back separately. */
export function buildItinerary<T extends { startDate?: Date | null }>(items: T[], departDate?: Date | null) {
  const dated = items.filter((i) => i.startDate).sort((a, b) => +a.startDate! - +b.startDate!);
  const undated = items.filter((i) => !i.startDate);
  const days: { key: string; date: Date; dayNumber: number | null; items: T[] }[] = [];
  const base = departDate ? Date.UTC(departDate.getUTCFullYear(), departDate.getUTCMonth(), departDate.getUTCDate()) : null;
  for (const it of dated) {
    const key = dayKey(it.startDate!);
    let day = days.find((d) => d.key === key);
    if (!day) {
      const t = Date.UTC(it.startDate!.getUTCFullYear(), it.startDate!.getUTCMonth(), it.startDate!.getUTCDate());
      const n = base !== null ? Math.round((t - base) / 86_400_000) + 1 : null;
      day = { key, date: it.startDate!, dayNumber: n !== null && n >= 1 ? n : null, items: [] };
      days.push(day);
    }
    day.items.push(it);
  }
  return { days, undated };
}

export async function buildTravelDocumentPdf(input: TravelDocInput): Promise<Uint8Array> {
  const { kind, store, trip, client } = input;
  const now = input.now ?? new Date();
  const items = input.items.filter((i) => i.status !== "CANCELLED");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Helvetica only covers WinAnsi and drawText throws on anything else (e.g. Yoruba dot-below letters),
  // so strip or replace characters we can't draw. Same approach as the invoice route.
  const supported = new Set(font.getCharacterSet());
  const safe = (text: string) => {
    let out = "";
    for (const ch of String(text ?? "").normalize("NFC")) {
      const cp = ch.codePointAt(0)!;
      if (cp < 32 || cp === 127) { out += " "; continue; }
      if (cp >= 0x300 && cp <= 0x36f) continue;
      if (supported.has(cp)) { out += ch; continue; }
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      out += base && [...base].every((c) => supported.has(c.codePointAt(0)!)) ? base : "?";
    }
    return out;
  };

  const money = (n: number) => `${trip.currency.toUpperCase()} ${formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2, locale: input.locale })}`;

  const W = 595.28, H = 841.89, left = 50, right = 545, TOP = 800, BOTTOM = 70;
  const ink = rgb(0.1, 0.1, 0.1), muted = rgb(0.4, 0.4, 0.4), line = rgb(0.82, 0.82, 0.82), accent = rgb(0.06, 0.32, 0.55);
  let page: PDFPage = doc.addPage([W, H]);
  let y = TOP;

  const text = (s: string, x: number, size = 10, opts: { b?: boolean; color?: ReturnType<typeof rgb>; font?: PDFFont } = {}) =>
    page.drawText(safe(s), { x, y, size, font: opts.font ?? (opts.b ? bold : font), color: opts.color ?? ink });
  const textRight = (s: string, xRight: number, size = 10, b = false, color = ink) => {
    const f = b ? bold : font;
    page.drawText(safe(s), { x: xRight - f.widthOfTextAtSize(safe(s), size), y, size, font: f, color });
  };
  const wrap = (s: string, maxW: number, size: number, f: PDFFont = font): string[] => {
    const words = safe(s).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) <= maxW) { cur = test; continue; }
      if (cur) lines.push(cur);
      // hard-break a single word that is wider than the column
      let rest = w;
      while (f.widthOfTextAtSize(rest, size) > maxW && rest.length > 1) {
        let n = rest.length - 1;
        while (n > 1 && f.widthOfTextAtSize(rest.slice(0, n), size) > maxW) n--;
        lines.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      cur = rest;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };
  const rule = (x1 = left, x2 = right) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: line });
  const ensure = (needed: number, onNewPage?: () => void) => {
    if (y - needed >= BOTTOM) return;
    page = doc.addPage([W, H]);
    y = TOP;
    onNewPage?.();
  };
  const heading = (s: string) => { ensure(60); y -= 8; text(s.toUpperCase(), left, 9, { b: true, color: accent }); y -= 6; rule(); y -= 16; };

  // ---- header
  const title = kind === "quote" ? "QUOTATION" : kind === "invoice" ? "INVOICE" : "TRAVEL ITINERARY";
  text(store.name, left, 18, { b: true });
  textRight(title, right, 18, true, accent);
  y -= 16;
  const contact = [store.contactPhone, store.whatsappNumber && store.whatsappNumber !== store.contactPhone ? `WhatsApp ${store.whatsappNumber}` : null, store.contactEmail].filter(Boolean).join("  |  ");
  if (contact) text(contact, left, 9, { color: muted });
  textRight(`Ref ${trip.reference}`, right, 10, false, muted);
  y -= 13;
  textRight(`Date ${dateFmt(now)}`, right, 10, false, muted);
  y -= 26;

  // ---- client and trip blocks (two columns)
  const colTop = y;
  text("PREPARED FOR", left, 8, { b: true, color: muted }); y -= 14;
  text(client.fullName, left, 11, { b: true }); y -= 14;
  if (client.phone) { text(client.phone, left, 10); y -= 13; }
  if (client.email) { text(client.email, left, 10); y -= 13; }
  const leftEnd = y;
  y = colTop;
  const col2 = 320;
  text("TRIP", col2, 8, { b: true, color: muted }); y -= 14;
  for (const l of wrap(trip.title, right - col2, 11, bold)) { text(l, col2, 11, { b: true }); y -= 14; }
  text(`Destination: ${trip.destination}`, col2, 10); y -= 13;
  if (trip.departDate || trip.returnDate) { text(`${dateFmt(trip.departDate) || "TBC"} to ${dateFmt(trip.returnDate) || "TBC"}`, col2, 10); y -= 13; }
  y = Math.min(y, leftEnd) - 10;

  // ---- travellers
  if (input.travellers.length) {
    heading(`Travellers (${input.travellers.length})`);
    for (const t of input.travellers) {
      ensure(16);
      text(`${t.fullName}${t.isLead ? " (lead traveller)" : ""}`, left, 10);
      y -= 14;
    }
  }

  // ---- itinerary (all kinds; this is the whole document for "itinerary")
  const { days, undated } = buildItinerary(items, trip.departDate);
  const showItinerary = days.length > 0 || (kind === "itinerary" && undated.length > 0);
  if (showItinerary) {
    heading("Itinerary");
    for (const d of days) {
      ensure(40);
      text(`${d.dayNumber ? `Day ${d.dayNumber}  -  ` : ""}${longDateFmt(d.date)}`, left, 10, { b: true });
      y -= 14;
      for (const it of d.items) {
        const range = it.endDate && dayKey(it.endDate) !== dayKey(it.startDate!) ? ` (until ${dateFmt(it.endDate)})` : "";
        const label = `${KIND_LABEL[it.kind] ?? "Service"}: ${it.description}${range}${it.confirmationRef && kind !== "quote" ? `  [Conf. ${it.confirmationRef}]` : ""}`;
        const lines = wrap(label, right - left - 14, 10);
        ensure(lines.length * 13 + 4);
        lines.forEach((l, idx) => { text(idx === 0 ? `- ${l}` : `  ${l}`, left + 8, 10); y -= 13; });
      }
      y -= 6;
    }
    if (undated.length && kind === "itinerary") {
      ensure(30);
      text("Dates to be confirmed", left, 10, { b: true }); y -= 14;
      for (const it of undated) {
        const lines = wrap(`${KIND_LABEL[it.kind] ?? "Service"}: ${it.description}`, right - left - 14, 10);
        ensure(lines.length * 13 + 4);
        lines.forEach((l, idx) => { text(idx === 0 ? `- ${l}` : `  ${l}`, left + 8, 10); y -= 13; });
      }
    }
  }

  if (kind === "itinerary") {
    ensure(40); y -= 10;
    for (const l of wrap("Please keep your passport valid for at least 6 months beyond your return date and carry this itinerary with you. Times and details may be updated by the airline or suppliers.", right - left, 9)) { text(l, left, 9, { color: muted }); y -= 12; }
  } else {
    // ---- services and pricing
    heading("Services and pricing");
    const amountX = right;
    const descW = amountX - left - 110;
    const headerRow = () => { text("Description", left, 9, { b: true, color: muted }); textRight("Amount", amountX, 9, true, muted); y -= 6; rule(); y -= 14; };
    headerRow();
    if (items.length) {
      for (const it of items) {
        const lines = wrap(`${KIND_LABEL[it.kind] ?? "Service"}: ${it.description}${it.startDate ? ` (${dateFmt(it.startDate)})` : ""}`, descW, 10);
        ensure(lines.length * 13 + 6, headerRow);
        const top = y;
        lines.forEach((l) => { text(l, left, 10); y -= 13; });
        const bottom = y;
        y = top;
        textRight(money(it.sellPrice), amountX, 10);
        y = bottom - 4;
      }
    } else {
      ensure(20, headerRow);
      text(trip.title, left, 10); textRight(money(trip.totalPrice), amountX, 10); y -= 17;
    }

    // ---- totals
    const received = input.payments.filter((p) => p.status === "RECEIVED" || p.status === "REFUNDED");
    const paid = received.reduce((s, p) => s + netReceived(p), 0);
    const balance = Math.max(0, trip.totalPrice - paid);
    ensure(kind === "invoice" ? 90 : 40);
    y -= 4; rule(330, right); y -= 16;
    const totalLine = (label: string, value: string, b = false) => { text(label, 330, b ? 11 : 10, { b }); textRight(value, right, b ? 11 : 10, b); y -= 16; };
    totalLine("Total", money(trip.totalPrice), true);
    if (kind === "invoice") {
      totalLine("Paid to date", money(paid));
      totalLine("Balance due", money(balance), true);
    }

    // ---- payment history and upcoming instalments (invoice only)
    if (kind === "invoice") {
      const due = input.payments.filter((p) => p.status === "DUE").sort((a, b) => (+(a.dueDate ?? 0)) - (+(b.dueDate ?? 0)));
      if (received.length) {
        heading("Payments received");
        for (const p of received) {
          ensure(16);
          text(`${dateFmt(p.paidAt) || "-"}  |  ${p.method}${p.reference ? `  |  ${p.reference}` : ""}`, left, 10);
          textRight(money(p.amount), right, 10);
          y -= 14;
          if ((p.refundedAmount ?? 0) > 0) {
            ensure(16);
            text("Refunded", left + 8, 10, { color: muted });
            textRight(`-${money(p.refundedAmount!)}`, right, 10, false, muted);
            y -= 14;
          }
        }
      }
      if (due.length) {
        heading("Payment schedule");
        for (const p of due) {
          ensure(16);
          text(`Due ${dateFmt(p.dueDate) || "on request"}`, left, 10);
          textRight(money(p.amount), right, 10);
          y -= 14;
        }
      }
    }

    ensure(50); y -= 10;
    const note = kind === "quote"
      ? "This quotation is an estimate. Prices and availability are subject to change until a deposit is received and services are confirmed. Please confirm your passport is valid for at least 6 months beyond your return date."
      : "Please quote the reference above when making payment. Thank you for travelling with us.";
    for (const l of wrap(note, right - left, 9)) { text(l, left, 9, { color: muted }); y -= 12; }
  }

  // ---- footers
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(safe(`${store.name}  |  ${trip.reference}`), { x: left, y: 40, size: 8, font, color: muted });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: right - font.widthOfTextAtSize(label, 8), y: 40, size: 8, font, color: muted });
  });

  return doc.save();
}
