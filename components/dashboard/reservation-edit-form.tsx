"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bell, Calendar, Mail, Phone, Plus, Send, Trash2, User, X } from "lucide-react";
import { updateReservation, updateBookingStatus, type BookingStatusValue } from "@/lib/actions/booking";
import { BookingStatusBadge } from "@/components/dashboard/booking-status-badge";

type Unit = { id: string; label: string; location: string | null; capacity: number | null };
type Addon = { label: string; price: number };

type Reservation = {
  id: string;
  scheduledAt: string;
  durationMins: number;
  status: string;
  partySize: number | null;
  specialRequests: string[];
  notes: string | null;
  source: string | null;
  reservationType: string | null;
  addons: Addon[];
  reminderOffsetMinutes: number | null;
  sendConfirmation: boolean;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  memberSince: string;
  unitId: string | null;
  unitLabel: string | null;
  unitLocation: string | null;
  createdAt: string;
  createdBy: string;
};

const STATUS_OPTIONS: BookingStatusValue[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "120", label: "2 hours before" },
  { value: "1440", label: "1 day before" },
];

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}
function toTimeInputValue(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(11, 16);
}
function fmtCurrency(n: number) {
  return `₦${n.toLocaleString()}`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function ReservationEditForm({
  slug,
  unitLabel,
  customerLabel,
  units,
  totalReservations,
  reservation,
}: {
  slug: string;
  unitLabel: string;
  customerLabel: string;
  units: Unit[];
  totalReservations: number;
  reservation: Reservation;
}) {
  const router = useRouter();
  const [guestName, setGuestName] = useState(reservation.guestName);
  const [guestPhone, setGuestPhone] = useState(reservation.guestPhone);
  const [guestEmail, setGuestEmail] = useState(reservation.guestEmail);
  const [date, setDate] = useState(toDateInputValue(reservation.scheduledAt));
  const [time, setTime] = useState(toTimeInputValue(reservation.scheduledAt));
  const [durationMins, setDurationMins] = useState(reservation.durationMins);
  const [unitId, setUnitId] = useState(reservation.unitId ?? "");
  const [partySize, setPartySize] = useState(reservation.partySize ?? 1);
  const [status, setStatus] = useState<BookingStatusValue>(reservation.status as BookingStatusValue);
  const [source, setSource] = useState(reservation.source ?? "Walk-in");
  const [reservationType, setReservationType] = useState(reservation.reservationType ?? "Standard");
  const [specialRequests, setSpecialRequests] = useState(reservation.specialRequests.join("\n"));
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [addons, setAddons] = useState<Addon[]>(reservation.addons ?? []);
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<string>(
    reservation.reminderOffsetMinutes != null ? String(reservation.reminderOffsetMinutes) : ""
  );
  const [sendConfirmation, setSendConfirmation] = useState(reservation.sendConfirmation);
  const [saving, setSaving] = useState(false);

  const addonsTotal = useMemo(() => addons.reduce((sum, a) => sum + (Number(a.price) || 0), 0), [addons]);

  function addAddon() {
    setAddons((v) => [...v, { label: "", price: 0 }]);
  }
  function updateAddon(i: number, field: "label" | "price", value: string) {
    setAddons((v) => v.map((a, idx) => (idx === i ? { ...a, [field]: field === "price" ? Number(value) || 0 : value } : a)));
  }
  function removeAddon(i: number) {
    setAddons((v) => v.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!guestName.trim()) return toast.error("Guest name is required.");
    if (!date || !time) return toast.error("Date and time are required.");
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const result = await updateReservation(slug, reservation.id, {
      guestName,
      guestPhone,
      guestEmail,
      scheduledAt,
      durationMins,
      unitId: unitId || null,
      partySize,
      status,
      source,
      reservationType,
      specialRequests: specialRequests.split("\n").map((s) => s.trim()).filter(Boolean),
      notes,
      addons: addons.filter((a) => a.label.trim()),
      reminderOffsetMinutes: reminderOffsetMinutes ? Number(reminderOffsetMinutes) : null,
      sendConfirmation,
    });
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Reservation updated");
    router.push(`/${slug}/admin/bookings`);
    router.refresh();
  }

  async function cancel() {
    if (!window.confirm("Cancel this reservation? The guest will need to be notified separately.")) return;
    setSaving(true);
    const result = await updateBookingStatus(slug, reservation.id, "CANCELLED");
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Reservation cancelled");
    setStatus("CANCELLED");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-lg border p-2 hover:bg-muted" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Edit Reservation</h1>
            <p className="text-xs text-muted-foreground">Update reservation details and preferences</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">Reservation Information</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Guest Name</label>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone Number</label>
                <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="input" />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-sm font-medium">Email Address</label>
                <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Duration (mins)</label>
                <input type="number" min={15} step={15} value={durationMins} onChange={(e) => setDurationMins(Number(e.target.value))} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{unitLabel}</label>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="input">
                  <option value="">Unassigned</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}{u.location ? ` (${u.location})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{customerLabel}s</label>
                <input type="number" min={1} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as BookingStatusValue)} className="input">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
                  <option>Walk-in</option>
                  <option>Online</option>
                  <option>Phone</option>
                  <option>Third-party</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Reservation Type</label>
                <input value={reservationType} onChange={(e) => setReservationType(e.target.value)} placeholder="e.g. Standard, VIP" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Created By</label>
                <input value={reservation.createdBy} disabled className="input bg-muted text-muted-foreground" />
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-semibold">Special Requests</label>
            <p className="mb-2 text-xs text-muted-foreground">Visible to the guest on their confirmation. One per line.</p>
            <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} rows={3} className="input" placeholder="Birthday celebration&#10;Window seat preferred" />
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-semibold">Notes (Internal)</label>
            <p className="mb-2 text-xs text-muted-foreground">Only visible to your team.</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input" placeholder="Anything staff should know before the guest arrives" />
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add-ons & Extras</h2>
              <button type="button" onClick={addAddon} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add extra
              </button>
            </div>
            {addons.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No add-ons on this reservation.</p>
            ) : (
              <div className="space-y-2">
                {addons.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={a.label} onChange={(e) => updateAddon(i, "label", e.target.value)} placeholder="e.g. Birthday Celebration" className="input flex-1" />
                    <input type="number" min={0} value={a.price} onChange={(e) => updateAddon(i, "price", e.target.value)} placeholder="Price" className="input w-32" />
                    <button type="button" onClick={() => removeAddon(i)} className="shrink-0 rounded-md p-2 text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
            {addons.length > 0 && (
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Total add-ons</span>
                <span className="font-semibold">{fmtCurrency(addonsTotal)}</span>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Reminder</label>
                <select value={reminderOffsetMinutes} onChange={(e) => setReminderOffsetMinutes(e.target.value)} className="input">
                  {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Send Confirmation</p>
                  <p className="text-xs text-muted-foreground">Send booking confirmation to guest</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSendConfirmation((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${sendConfirmation ? "bg-emerald-500" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${sendConfirmation ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={cancel} disabled={saving || status === "CANCELLED"} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              Cancel Reservation
            </button>
            <button onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
            <button onClick={save} disabled={saving} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Reservation Summary</h2>
            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Reservation ID</dt><dd className="font-medium">#{reservation.id.slice(-6).toUpperCase()}</dd></div>
              <div className="flex items-center justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Date & Time</dt><dd className="font-medium">{fmtDateTime(new Date(`${date}T${time}`).toISOString())}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">{unitLabel}</dt><dd className="font-medium">{units.find((u) => u.id === unitId)?.label ?? "Unassigned"}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">{customerLabel}s</dt><dd className="font-medium">{partySize}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Status</dt><dd><BookingStatusBadge status={status} /></dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Reservation Type</dt><dd className="font-medium">{reservationType || "—"}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Duration</dt><dd className="font-medium">{durationMins} mins</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Created</dt><dd className="font-medium">{fmtDateTime(reservation.createdAt)}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Total Add-ons</dt><dd className="font-medium">{fmtCurrency(addonsTotal)}</dd></div>
            </dl>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Guest Information</h2>
            </div>
            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><User className="h-3.5 w-3.5" /> Guest Name</dt><dd className="font-medium">{guestName}</dd></div>
              <div className="flex items-center justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> Phone</dt><dd className="font-medium">{guestPhone || "—"}</dd></div>
              <div className="flex items-center justify-between"><dt className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Email</dt><dd className="font-medium">{guestEmail || "—"}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Total Reservations</dt><dd className="font-medium">{totalReservations} times</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Member Since</dt><dd className="font-medium">{new Date(reservation.memberSince).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</dd></div>
            </dl>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Quick Actions</h2>
            <div className="space-y-2">
              <button type="button" onClick={() => toast.info("Reminder queued.")} className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Send className="h-4 w-4" /> Send Reminder
              </button>
              <button type="button" onClick={() => toast.info("Jot it in the Notes (Internal) field and save.")} className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Bell className="h-4 w-4" /> Add Note
              </button>
              <button type="button" onClick={cancel} disabled={saving || status === "CANCELLED"} className="flex w-full items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                <X className="h-4 w-4" /> Cancel Reservation
              </button>
            </div>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: hsl(var(--background));
        }
      `}</style>
    </div>
  );
}
