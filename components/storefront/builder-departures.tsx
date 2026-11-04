"use client";

import type { BuilderConfig } from "@/lib/builder-config";
import type { PublicTravelPackage } from "@/lib/travel-public";
import { formatMoney } from "@/lib/utils/format-money";
import { TravelEnquiryForm } from "@/components/storefront/travel-enquiry-form";

/**
 * Open group departures and the enquiry / booking form, drawn in any Builder template's design.
 * It appears only when the agency has BizNest Travel installed and has open departures, so no template carries
 * travel wording of its own: the block exists because the business has the content.
 */
export function BuilderDepartures({ slug, packages, d }: { slug: string; packages: PublicTravelPackage[]; d: BuilderConfig["design"] }) {
  if (!packages.length) return null;
  const line = `${d.text}1f`;
  return (
    <section id="departures" className="bn-section bn-dep" style={{ padding: "64px 0", background: d.background }}>
      <style>{`
        .bn-dep .te,.bn-dep .te-ok{margin:28px 0 0;border:1px solid ${line};border-radius:${d.radius}px;padding:22px;display:grid;gap:10px;max-width:560px;background:${d.surface}}
        .bn-dep .te h3{margin:0 0 4px;font-family:${d.headingFont}}
        .bn-dep .te input,.bn-dep .te select,.bn-dep .te textarea{border:1px solid ${line};border-radius:${Math.min(d.radius, 12)}px;padding:11px 14px;font:inherit;font-size:14px;width:100%;background:${d.background};color:${d.text}}
        .bn-dep .te textarea{min-height:80px}
        .bn-dep .te button{background:${d.primary};color:#fff;border:0;border-radius:${d.buttonStyle === "pill" ? 999 : Math.min(d.radius, 12)}px;padding:13px;font-weight:700;cursor:pointer}
        .bn-dep .te button:disabled{opacity:.6}
        .bn-dep .te button.te-alt{background:transparent;color:${d.text};border:1px solid ${d.text}55}
        .bn-dep .te .te-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
        .bn-dep .te-err{color:#b91c1c;font-size:13px;margin:0}
        .bn-dep .te-ok span{color:${d.muted};font-size:14px}
      `}</style>
      <div className="bn-wrap">
        <p style={{ margin: 0, color: d.accent, fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>Fixed-price departures</p>
        <h2 style={{ fontFamily: d.headingFont, fontSize: 32, lineHeight: 1.15, margin: "8px 0 24px" }}>Upcoming departures</h2>
        <div className="bn-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
          {packages.map((g) => (
            <div key={g.id} style={{ border: `1px solid ${line}`, borderRadius: d.radius, background: d.surface, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <h3 style={{ margin: 0, fontFamily: d.headingFont, fontSize: 18 }}>{g.name}</h3>
              <small style={{ color: d.muted }}>{g.destination} · {g.durationDays} day{g.durationDays === 1 ? "" : "s"}{g.departureDate ? ` · departs ${new Date(g.departureDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}</small>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(g.pricePerPerson, g.currency)}<small style={{ fontSize: 12, fontWeight: 500, color: d.muted }}> per person</small></div>
              {g.inclusions && <small style={{ color: d.muted }}>{g.inclusions.slice(0, 110)}</small>}
              {g.seatsLeft !== null && <span style={{ fontSize: 12, fontWeight: 700, color: g.seatsLeft <= 5 ? "#b45309" : d.accent }}>{g.seatsLeft === 0 ? "Fully booked" : `${g.seatsLeft} seat${g.seatsLeft === 1 ? "" : "s"} left`}</span>}
              <a href="#enquire" style={{ marginTop: "auto", textAlign: "center", padding: 12, fontWeight: 700, fontSize: 14, color: "#fff", background: d.primary, borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(d.radius, 12) }}>{g.bookable ? `Book now · ${g.depositPercent}% deposit` : "Enquire about this departure"}</a>
            </div>
          ))}
        </div>
        <TravelEnquiryForm slug={slug} packages={packages.map((g) => ({ id: g.id, name: g.name, seatsLeft: g.seatsLeft, bookable: g.bookable, depositPercent: g.depositPercent, depositPerPerson: g.depositPerPerson, currency: g.currency }))} />
      </div>
    </section>
  );
}
