"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDaysISO, isoDate } from "@/lib/hotel-booking-query";
import { storePath } from "@/lib/storefront-menu";

/**
 * Check-in / check-out / guests for a hotel home or rooms page. "Check Availability" opens the real booking
 * flow (/book) with those choices filled in, the same hand-off the Luso template's bar uses.
 * Renders bare labels + a button so the template's own `.gv-search` / `.gt-booking` styling applies.
 */
export function StayBar({ slug, variant }: { slug: string; variant: "gv" | "gt" }) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [today, setToday] = useState("");

  // Dates come from the visitor's own clock after mount, so server and browser markup always match.
  useEffect(() => {
    const t = isoDate(new Date());
    setToday(t);
    setCheckIn(t);
    setCheckOut(addDaysISO(t, 1));
  }, []);

  const up = variant === "gv";
  const L = (s: string) => (up ? s.toUpperCase() : s);
  const q = checkIn && checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}` : "";

  return (
    <>
      <label>{L("Check in")}<input type="date" value={checkIn} min={today || undefined} onChange={(e) => { const v = e.target.value; setCheckIn(v); if (v && checkOut <= v) setCheckOut(addDaysISO(v, 1)); }} /></label>
      <label>{L("Check out")}<input type="date" value={checkOut} min={checkIn ? addDaysISO(checkIn, 1) : undefined} onChange={(e) => setCheckOut(e.target.value)} /></label>
      <label>{L("Guests")}
        <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "Guest" : "Guests"}</option>)}
        </select>
      </label>
      <Link className={up ? "gv-book" : "gt-btn"} href={storePath(slug, `/book${q}`)}>{up ? "CHECK AVAILABILITY" : "Check Availability"}</Link>
    </>
  );
}
