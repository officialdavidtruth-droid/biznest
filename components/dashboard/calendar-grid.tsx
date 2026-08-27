"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUnitBooking, updateBookingGuestInfo, updateUnitStatus, checkOutUnitBooking } from "@/lib/actions/service-unit";
import { SingleImageUpload } from "@/components/forms/single-image-upload";

type Booking = {
  id: string;
  checkIn: Date | string | null;
  checkOut: Date | string | null;
  status: string;
  guestName: string | null;
  guestPhone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  governmentIdType: string | null;
  governmentIdNumber: string | null;
  governmentIdImageUrl: string | null;
  notes: string | null;
};

type Unit = {
  id: string;
  label: string;
  status: string;
  bookings: Booking[];
};

type ServiceWithUnits = {
  id: string;
  name: string;
  units: Unit[];
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OCCUPIED: "bg-blue-50 text-blue-700 border-blue-200",
  RESERVED: "bg-amber-50 text-amber-700 border-amber-200",
  DIRTY: "bg-rose-50 text-rose-700 border-rose-200",
  CLEANING: "bg-purple-50 text-purple-700 border-purple-200",
  MAINTENANCE: "bg-slate-100 text-slate-600 border-slate-200",
  OUT_OF_SERVICE: "bg-slate-200 text-slate-500 border-slate-300",
};

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dateRange(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  while (cur <= end) {
    out.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function CalendarGrid({
  slug,
  services,
  rangeStart,
  rangeEnd,
}: {
  slug: string;
  services: ServiceWithUnits[];
  rangeStart: string;
  rangeEnd: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createFor, setCreateFor] = useState<{ serviceId: string; unitId: string; date: string } | null>(null);
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => dateRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  function goToWeek(offsetDays: number) {
    const next = new Date(`${rangeStart}T00:00:00`);
    next.setDate(next.getDate() + offsetDays);
    router.push(`?from=${toISODate(next)}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => goToWeek(-14)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">← 2 weeks</button>
          <button onClick={() => router.push(`?from=${toISODate(new Date())}`)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Today</button>
          <button onClick={() => goToWeek(14)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">2 weeks →</button>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date(`${rangeStart}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {new Date(`${rangeEnd}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      {services.map((service) => (
        <div key={service.id} className="overflow-hidden rounded-2xl border">
          <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">{service.name}</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-background">
                  <th className="sticky left-0 z-10 min-w-[90px] border-r bg-background px-2 py-2 text-left font-medium">Unit</th>
                  {days.map((d) => (
                    <th key={d} className="min-w-[64px] border-r px-1 py-2 text-center font-medium text-muted-foreground last:border-r-0">
                      {new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {service.units.map((unit) => {
                  // For each day, find whether it's covered by a booking. Merge
                  // consecutive days under the same booking into one cell.
                  const cells: Array<{ date: string; booking: Booking | null; span: number }> = [];
                  let i = 0;
                  while (i < days.length) {
                    const date = days[i];
                    const dayStart = new Date(`${date}T00:00:00`);
                    const booking = unit.bookings.find((b) => {
                      if (!b.checkIn || !b.checkOut) return false;
                      const ci = new Date(b.checkIn);
                      const co = new Date(b.checkOut);
                      return dayStart >= new Date(ci.toDateString()) && dayStart < new Date(co.toDateString());
                    }) ?? null;

                    if (!booking) {
                      cells.push({ date, booking: null, span: 1 });
                      i++;
                      continue;
                    }

                    let span = 1;
                    while (i + span < days.length) {
                      const nextDayStart = new Date(`${days[i + span]}T00:00:00`);
                      const ci = new Date(booking.checkIn!);
                      const co = new Date(booking.checkOut!);
                      if (nextDayStart >= new Date(ci.toDateString()) && nextDayStart < new Date(co.toDateString())) span++;
                      else break;
                    }
                    cells.push({ date, booking, span });
                    i += span;
                  }

                  return (
                    <tr key={unit.id} className="border-b last:border-0">
                      <td className="sticky left-0 z-10 border-r bg-background px-2 py-2">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium">{unit.label}</span>
                          <select
                            value={unit.status}
                            disabled={isPending}
                            onChange={(e) => {
                              const status = e.target.value as Parameters<typeof updateUnitStatus>[2];
                              startTransition(async () => {
                                const res = await updateUnitStatus(slug, unit.id, status);
                                if (!res.success) setError(res.error);
                                router.refresh();
                              });
                            }}
                            className={`rounded border px-1 py-0.5 text-[10px] ${STATUS_COLORS[unit.status] ?? ""}`}
                          >
                            {Object.keys(STATUS_COLORS).map((s) => (
                              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      {cells.map((cell) => (
                        <td
                          key={cell.date}
                          colSpan={cell.span}
                          className="cursor-pointer border-r px-1 py-2 text-center last:border-r-0 hover:bg-muted/50"
                          onClick={() => {
                            if (cell.booking) setViewingBooking(cell.booking);
                            else setCreateFor({ serviceId: service.id, unitId: unit.id, date: cell.date });
                          }}
                        >
                          {cell.booking ? (
                            <div className="truncate rounded bg-primary/10 px-1.5 py-1 font-medium text-primary">
                              {cell.booking.guestName ?? "Guest TBD"}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">+</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {createFor && (
        <CreateBookingModal
          slug={slug}
          serviceId={createFor.serviceId}
          unitId={createFor.unitId}
          initialDate={createFor.date}
          onClose={() => setCreateFor(null)}
          onCreated={() => {
            setCreateFor(null);
            router.refresh();
          }}
          onError={setError}
        />
      )}

      {viewingBooking && (
        <GuestInfoModal
          slug={slug}
          booking={viewingBooking}
          onClose={() => setViewingBooking(null)}
          onSaved={() => {
            setViewingBooking(null);
            router.refresh();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function CreateBookingModal({
  slug,
  serviceId,
  unitId,
  initialDate,
  onClose,
  onCreated,
  onError,
}: {
  slug: string;
  serviceId: string;
  unitId: string;
  initialDate: string;
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const nextDay = useMemo(() => {
    const d = new Date(`${initialDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  }, [initialDate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await createUnitBooking(slug, {
              serviceId,
              unitId,
              checkIn: String(fd.get("checkIn")),
              checkOut: String(fd.get("checkOut")),
              guestName: String(fd.get("guestName") ?? ""),
              guestPhone: String(fd.get("guestPhone") ?? ""),
            });
            if (!res.success) onError(res.error);
            else onCreated();
          });
        }}
        className="w-full max-w-sm rounded-xl border bg-background p-4 shadow-lg"
      >
        <h2 className="mb-3 text-sm font-semibold">New booking</h2>
        <label className="mb-1 block text-xs text-muted-foreground">Check-in</label>
        <input name="checkIn" type="date" defaultValue={initialDate} required className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
        <label className="mb-1 block text-xs text-muted-foreground">Check-out</label>
        <input name="checkOut" type="date" defaultValue={nextDay} required className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
        <label className="mb-1 block text-xs text-muted-foreground">Guest name (optional)</label>
        <input name="guestName" className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />
        <label className="mb-1 block text-xs text-muted-foreground">Guest phone (optional)</label>
        <input name="guestPhone" className="mb-4 w-full rounded-md border px-3 py-1.5 text-sm" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
          <button type="submit" disabled={isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">
            {isPending ? "Creating…" : "Create booking"}
          </button>
        </div>
      </form>
    </div>
  );
}

function GuestInfoModal({
  slug,
  booking,
  onClose,
  onSaved,
  onError,
}: {
  slug: string;
  booking: Booking;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [idImageUrl, setIdImageUrl] = useState(booking.governmentIdImageUrl ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await updateBookingGuestInfo(slug, booking.id, {
              guestName: String(fd.get("guestName") ?? ""),
              guestPhone: String(fd.get("guestPhone") ?? ""),
              emergencyContactName: String(fd.get("emergencyContactName") ?? ""),
              emergencyContactPhone: String(fd.get("emergencyContactPhone") ?? ""),
              governmentIdType: String(fd.get("governmentIdType") ?? ""),
              governmentIdImageUrl: idImageUrl,
              notes: String(fd.get("notes") ?? ""),
            });
            if (!res.success) onError(res.error);
            else onSaved();
          });
        }}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl border bg-background p-4 shadow-lg"
      >
        <h2 className="mb-3 text-sm font-semibold">Guest details</h2>

        <label className="mb-1 block text-xs text-muted-foreground">Guest name</label>
        <input name="guestName" defaultValue={booking.guestName ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

        <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
        <input name="guestPhone" defaultValue={booking.guestPhone ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

        <label className="mb-1 block text-xs text-muted-foreground">Emergency contact name</label>
        <input name="emergencyContactName" defaultValue={booking.emergencyContactName ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

        <label className="mb-1 block text-xs text-muted-foreground">Emergency contact phone</label>
        <input name="emergencyContactPhone" defaultValue={booking.emergencyContactPhone ?? ""} className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

        <label className="mb-1 block text-xs text-muted-foreground">Government ID type</label>
        <input name="governmentIdType" defaultValue={booking.governmentIdType ?? ""} placeholder="e.g. National ID, Passport" className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm" />

        <label className="mb-1 block text-xs text-muted-foreground">Government ID photo</label>
        <div className="mb-4">
          <SingleImageUpload value={idImageUrl} onChange={setIdImageUrl} label="Upload ID photo" />
        </div>

        <label className="mb-1 block text-xs text-muted-foreground">Notes</label>
        <textarea name="notes" defaultValue={booking.notes ?? ""} rows={2} className="mb-4 w-full rounded-md border px-3 py-1.5 text-sm" />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const res = await checkOutUnitBooking(slug, booking.id);
                if (!res.success) onError(res.error);
                else onSaved();
              });
            }}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive disabled:opacity-60"
          >
            Check out
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Close</button>
            <button type="submit" disabled={isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
  }
          
