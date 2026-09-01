"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calendar, Check, Pencil, Phone, Plus, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createReservation,
  createReservationUnit,
  updateBookingStatus,
  updateReservationDetails,
  type BookingStatusValue,
} from "@/lib/actions/booking";
import { BookingStatusBadge } from "@/components/dashboard/booking-status-badge";

type Unit = {
  id: string;
  label: string;
  location: string | null;
  capacity: number | null;
};

type Reservation = {
  id: string;
  scheduledAt: string;
  status: string;
  partySize: number | null;
  specialRequests: string[];
  guestName: string;
  guestPhone: string;
  unitId: string | null;
  unitLabel: string | null;
};

const TABS: Array<{ id: string; label: string; statuses: string[] | null }> = [
  { id: "all", label: "All Reservations", statuses: null },
  { id: "upcoming", label: "Upcoming", statuses: ["PENDING", "CONFIRMED"] },
  { id: "checked_in", label: "Checked In", statuses: ["CHECKED_IN"] },
  { id: "seated", label: "Seated", statuses: ["SEATED"] },
  { id: "completed", label: "Completed", statuses: ["COMPLETED"] },
  { id: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
  { id: "no_show", label: "No Show", statuses: ["NO_SHOW"] },
];

function fmtDateTime(value: string) {
  const d = new Date(value);
  return {
    date: d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

export function ReservationsWorkspace({
  slug,
  unitLabel,
  initialReservations,
  initialUnits,
}: {
  slug: string;
  unitLabel: string; // e.g. "Table"
  initialReservations: Reservation[];
  initialUnits: Unit[];
}) {
  const router = useRouter();
  const [reservations, setReservations] = useState(initialReservations);
  const [units, setUnits] = useState(initialUnits);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialReservations[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showUnitForm, setShowUnitForm] = useState(false);

  // New reservation form state
  const [fGuestName, setFGuestName] = useState("");
  const [fGuestPhone, setFGuestPhone] = useState("");
  const [fDateTime, setFDateTime] = useState("");
  const [fPartySize, setFPartySize] = useState("2");
  const [fUnitId, setFUnitId] = useState("");
  const [fNotes, setFNotes] = useState("");

  // New unit form state
  const [uLabel, setULabel] = useState("");
  const [uLocation, setULocation] = useState("");
  const [uCapacity, setUCapacity] = useState("");

  const stats = useMemo(() => {
    const total = reservations.length;
    const upcoming = reservations.filter((r) => ["PENDING", "CONFIRMED"].includes(r.status)).length;
    const checkedIn = reservations.filter((r) => r.status === "CHECKED_IN").length;
    const cancelled = reservations.filter((r) => r.status === "CANCELLED").length;
    const totalGuests = reservations
      .filter((r) => !["CANCELLED", "NO_SHOW"].includes(r.status))
      .reduce((sum, r) => sum + (r.partySize ?? 0), 0);
    return { total, upcoming, checkedIn, cancelled, totalGuests };
  }, [reservations]);

  const filtered = useMemo(() => {
    const activeTab = TABS.find((t) => t.id === tab);
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (activeTab?.statuses && !activeTab.statuses.includes(r.status)) return false;
      if (q && !`${r.guestName} ${r.guestPhone} ${r.unitLabel ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reservations, tab, search]);

  const selected = reservations.find((r) => r.id === selectedId) ?? null;

  async function run(action: () => Promise<any>, success: string) {
    setBusy(true);
    try {
      const result = await action();
      if (!result?.success) toast.error(result?.error ?? "Something went wrong");
      else toast.success(success);
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: BookingStatusValue, label: string) {
    const result = await run(() => updateBookingStatus(slug, id, status), label);
    if (result?.success) {
      setReservations((items) => items.map((r) => (r.id === id ? { ...r, status } : r)));
    }
  }

  async function assignUnit(id: string, unitId: string) {
    const result = await run(() => updateReservationDetails(slug, id, { unitId: unitId || null }), "Table assigned");
    if (result?.success) {
      const unit = units.find((u) => u.id === unitId);
      setReservations((items) => items.map((r) => (r.id === id ? { ...r, unitId: unitId || null, unitLabel: unit?.label ?? null } : r)));
    }
  }

  async function submitNewReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!fGuestName.trim() || !fDateTime) {
      toast.error("Guest name and date/time are required.");
      return;
    }
    const result = await run(
      () =>
        createReservation(slug, {
          scheduledAt: new Date(fDateTime).toISOString(),
          guestName: fGuestName,
          guestPhone: fGuestPhone || undefined,
          partySize: fPartySize ? Number(fPartySize) : undefined,
          unitId: fUnitId || null,
          specialRequests: fNotes.trim() ? [fNotes.trim()] : [],
        }),
      "Reservation created"
    );
    if (result?.success) {
      setShowNewForm(false);
      setFGuestName("");
      setFGuestPhone("");
      setFDateTime("");
      setFPartySize("2");
      setFUnitId("");
      setFNotes("");
      window.location.reload();
    }
  }

  async function submitNewUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!uLabel.trim()) {
      toast.error(`Give this ${unitLabel.toLowerCase()} a name.`);
      return;
    }
    const result = await run(
      () => createReservationUnit(slug, { label: uLabel, location: uLocation || null, capacity: uCapacity ? Number(uCapacity) : null }),
      `${unitLabel} added`
    );
    if (result?.success) {
      setShowUnitForm(false);
      setULabel("");
      setULocation("");
      setUCapacity("");
      window.location.reload();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reservations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all {unitLabel.toLowerCase()} reservations and bookings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUnitForm(true)}
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            + Add {unitLabel}
          </button>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> New Reservation
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Reservations", value: stats.total, tone: "bg-violet-50 text-violet-700" },
          { label: "Upcoming", value: stats.upcoming, tone: "bg-sky-50 text-sky-700" },
          { label: "Checked In", value: stats.checkedIn, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Cancelled", value: stats.cancelled, tone: "bg-rose-50 text-rose-700" },
          { label: "Total Guests", value: stats.totalGuests, tone: "bg-amber-50 text-amber-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className={`mt-2 inline-block rounded-md px-2 py-0.5 text-2xl font-bold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.id ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by guest, phone, or table..."
            className="mb-4 w-full rounded-lg border px-3 py-2 text-sm"
          />

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Guest & Contact</th>
                  <th className="px-4 py-2">{unitLabel}</th>
                  <th className="px-4 py-2">Guests</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No reservations here yet.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const { date, time } = fmtDateTime(r.scheduledAt);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`cursor-pointer border-b last:border-0 hover:bg-muted/30 ${selectedId === r.id ? "bg-orange-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{time}</div>
                        <div className="text-xs text-muted-foreground">{date}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.guestName}</div>
                        <div className="text-xs text-muted-foreground">{r.guestPhone || "—"}</div>
                      </td>
                      <td className="px-4 py-3">{r.unitLabel ?? "Unassigned"}</td>
                      <td className="px-4 py-3">{r.partySize ?? "—"}</td>
                      <td className="px-4 py-3">
                        <BookingStatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Reservation Details</h3>
              {selected && (
                <button
                  onClick={() => router.push(`/${slug}/admin/bookings/${selected.id}/edit`)}
                  className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium hover:bg-muted"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a reservation to see details.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Guest Name</p>
                  <p className="font-medium">{selected.guestName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <p>{selected.guestPhone || "No phone on file"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <p>{fmtDateTime(selected.scheduledAt).date} at {fmtDateTime(selected.scheduledAt).time}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <p>{selected.partySize ?? "—"} guests</p>
                </div>
                {selected.specialRequests?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Special Requests</p>
                    <p>{selected.specialRequests.join(", ")}</p>
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{unitLabel}</p>
                  <select
                    value={selected.unitId ?? ""}
                    onChange={(e) => assignUnit(selected.id, e.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border px-2 py-1.5 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label} {u.location ? `(${u.location})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <BookingStatusBadge status={selected.status} />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {["PENDING", "CONFIRMED"].includes(selected.status) && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(selected.id, "CHECKED_IN", "Checked in")}
                      className="flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
                    >
                      <Check className="h-3.5 w-3.5" /> Check In
                    </button>
                  )}
                  {selected.status === "CHECKED_IN" && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(selected.id, "SEATED", "Marked seated")}
                      className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-600"
                    >
                      Seat Guest
                    </button>
                  )}
                  {["CHECKED_IN", "SEATED"].includes(selected.status) && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(selected.id, "COMPLETED", "Marked completed")}
                      className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
                    >
                      Complete
                    </button>
                  )}
                  {["PENDING", "CONFIRMED"].includes(selected.status) && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(selected.id, "NO_SHOW", "Marked no-show")}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      No Show
                    </button>
                  )}
                  {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(selected.status) && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(selected.id, "CANCELLED", "Reservation cancelled")}
                      className="flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold">{unitLabel}s</h3>
            {units.length === 0 ? (
              <p className="text-sm text-muted-foreground">No {unitLabel.toLowerCase()}s added yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {units.map((u) => (
                  <li key={u.id} className="flex items-center justify-between">
                    <span>{u.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.location ?? ""} {u.capacity ? `· ${u.capacity} seats` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitNewReservation} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">New Reservation</h3>
              <button type="button" onClick={() => setShowNewForm(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <input required value={fGuestName} onChange={(e) => setFGuestName(e.target.value)} placeholder="Guest name" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={fGuestPhone} onChange={(e) => setFGuestPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input required type="datetime-local" value={fDateTime} onChange={(e) => setFDateTime(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input type="number" min={1} value={fPartySize} onChange={(e) => setFPartySize(e.target.value)} placeholder="Party size" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <select value={fUnitId} onChange={(e) => setFUnitId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">Assign {unitLabel.toLowerCase()} later</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
              <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Special requests" className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} />
            </div>
            <button disabled={busy} type="submit" className="mt-4 w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600">
              Create Reservation
            </button>
          </form>
        </div>
      )}

      {showUnitForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitNewUnit} className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Add {unitLabel}</h3>
              <button type="button" onClick={() => setShowUnitForm(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <input required value={uLabel} onChange={(e) => setULabel(e.target.value)} placeholder={`${unitLabel} name, e.g. "Table 5"`} className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={uLocation} onChange={(e) => setULocation(e.target.value)} placeholder="Location, e.g. Indoor / Outdoor" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input type="number" min={1} value={uCapacity} onChange={(e) => setUCapacity(e.target.value)} placeholder="Seats" className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <button disabled={busy} type="submit" className="mt-4 w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600">
              Add {unitLabel}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
