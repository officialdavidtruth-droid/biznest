"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Search } from "lucide-react";
import { findBookingByCode, type BookingCodeMatch } from "@/lib/actions/booking-code";
import { updateBookingStatus } from "@/lib/actions/booking";

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * "Verify booking code": the guest reads out (or shows) the code from their
 * confirmation email, staff type it here, see who it belongs to and whether
 * it's paid, then confirm the booking or check the guest in.
 */
export function BookingCodeVerifier({ slug }: { slug: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [match, setMatch] = useState<BookingCodeMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setMatch(null);
    startTransition(async () => {
      const result = await findBookingByCode(slug, code);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMatch(result.data);
    });
  }

  function move(status: "CONFIRMED" | "CHECKED_IN") {
    if (!match) return;
    startTransition(async () => {
      const result = await updateBookingStatus(slug, match.id, status);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "CONFIRMED" ? "Booking confirmed" : "Guest checked in");
      setMatch({ ...match, status });
      router.refresh();
    });
  }

  const paid = match?.paymentStatus === "PAID";

  return (
    <section className="rounded-xl border bg-[var(--bn-admin-surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">Verify booking code</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Enter the code from the guest&apos;s confirmation email to confirm their reservation. Older bookings work with their original booking ID.</p>

      <form onSubmit={lookup} className="mt-3 flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. K7M2QX9"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-full max-w-xs rounded-lg border bg-background px-3 py-2 font-mono text-sm uppercase tracking-widest sm:w-64"
        />
        <button type="submit" disabled={pending || !code.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <Search className="h-4 w-4" /> {pending ? "Checking…" : "Verify"}
        </button>
      </form>

      {error && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {match && (
        <div className="mt-4 rounded-xl border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-bold tracking-widest">{match.code.length > 12 ? `${match.code.slice(0, 8)}…` : match.code}</span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold">{match.status.replace("_", " ")}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {paid ? "Paid" : `Payment ${match.paymentStatus.toLowerCase()}`}
            </span>
            {match.legacy && <span className="text-[11px] text-muted-foreground">Older booking ID</span>}
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Guest</dt><dd className="font-medium">{match.guestName}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Contact</dt><dd>{[match.guestPhone, match.guestEmail].filter(Boolean).join(" · ") || "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Service</dt><dd>{match.serviceName}{match.unitLabel ? ` · ${match.unitLabel}` : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{match.checkIn ? "Stay" : "When"}</dt><dd>{match.checkIn ? `${fmt(match.checkIn)} → ${fmt(match.checkOut)}` : fmt(match.scheduledAt)}</dd></div>
            {match.partySize != null && <div><dt className="text-xs text-muted-foreground">Party size</dt><dd>{match.partySize}</dd></div>}
            {match.amount != null && <div><dt className="text-xs text-muted-foreground">Amount</dt><dd>{match.currency} {match.amount.toLocaleString()}</dd></div>}
          </dl>

          {!paid && match.status !== "CANCELLED" && <p className="mt-3 text-xs text-amber-700">This booking isn&apos;t marked as paid yet.</p>}
          {match.status === "CANCELLED" && <p className="mt-3 text-xs text-destructive">This booking was cancelled.</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {match.status === "PENDING" && (
              <button onClick={() => move("CONFIRMED")} disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                Confirm booking
              </button>
            )}
            {match.status === "CONFIRMED" && (
              <button onClick={() => move("CHECKED_IN")} disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                Check in guest
              </button>
            )}
            {match.status === "CHECKED_IN" && <span className="text-xs font-semibold text-emerald-700">Guest already checked in.</span>}
          </div>
        </div>
      )}
    </section>
  );
}
