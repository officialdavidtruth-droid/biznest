import { parseBookingNotes } from "@/lib/booking-notes";

/** Readable booking notes: labelled rows for structured details, plain text for the rest. */
export function BookingNotes({ notes, className = "" }: { notes: string | null | undefined; className?: string }) {
  const { rows, text } = parseBookingNotes(notes);
  if (!rows.length && !text) return null;
  return (
    <div className={`rounded-xl border bg-muted/30 p-4 ${className}`}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.label + r.value} className="contents">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="font-medium break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {text && <p className={`whitespace-pre-line text-sm ${rows.length ? "mt-3 border-t pt-3" : ""}`}>{text}</p>}
    </div>
  );
}
