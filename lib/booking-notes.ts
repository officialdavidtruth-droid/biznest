/**
 * Booking notes arrive in two shapes: free text typed by a person, and (from
 * the hotel storefront) a machine blob like {"extras":[],"data":{"guests":2,...}}.
 * This turns either into something a human can read. Pure and safe to use in
 * server and client components.
 */
export type NoteRow = { label: string; value: string };
export type ParsedNotes = { rows: NoteRow[]; text: string };

const clean = (v: unknown) => String(v ?? "").trim();

function structuredRows(obj: Record<string, unknown>): NoteRow[] | null {
  if (!("extras" in obj) && !("data" in obj)) return null;
  const data = obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : {};
  const rows: NoteRow[] = [];
  const guests = Number(data.guests);
  if (Number.isFinite(guests) && guests > 0) rows.push({ label: "Guests", value: String(guests) });
  const extrasRaw = Array.isArray(obj.extras) ? obj.extras : Array.isArray(data.extras) ? data.extras : [];
  const extras = extrasRaw.map((e) => clean(e).split("|")[0].trim()).filter(Boolean);
  if (extras.length) rows.push({ label: "Add-ons", value: extras.join(", ") });
  for (const key of ["specialRequests", "notes", "message"]) {
    const v = data[key] ?? obj[key];
    const text = Array.isArray(v) ? v.map(clean).filter(Boolean).join(", ") : clean(v);
    if (text) rows.push({ label: "Special requests", value: text });
  }
  return rows;
}

export function parseBookingNotes(raw: string | null | undefined): ParsedNotes {
  const text = clean(raw);
  if (!text) return { rows: [], text: "" };
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object") {
        const rows = structuredRows(obj as Record<string, unknown>);
        if (rows) return { rows, text: "" };
      }
    } catch {
      /* not JSON: fall through to plain text */
    }
  }
  const arrival = text.match(/^Preferred arrival time:\s*(.+)$/m);
  if (arrival) {
    const rest = text.replace(arrival[0], "").trim();
    return { rows: [{ label: "Preferred arrival", value: arrival[1].trim() }], text: rest };
  }
  return { rows: [], text };
}

/** Plain-text version, for textareas and for what gets stored on new bookings. */
export function formatBookingNotes(raw: string | null | undefined): string {
  const text = clean(raw);
  if (!text.startsWith("{")) return text;
  try {
    const obj = JSON.parse(text);
    const rows = obj && typeof obj === "object" ? structuredRows(obj as Record<string, unknown>) : null;
    if (rows) return rows.map((r) => `${r.label}: ${r.value}`).join("\n");
  } catch {
    /* keep as typed */
  }
  return text;
}
