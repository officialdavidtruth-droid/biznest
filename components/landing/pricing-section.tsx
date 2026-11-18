"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { formatMoney } from "@/lib/utils/format-money";
import { effectiveMonthlyFor, YEARLY_DISCOUNT, yearlyPriceFor, yearlySavingsFor, type BillingPeriod } from "@/lib/billing/period";
import { buildComparison, rankedPlans, type ComparablePlan } from "@/lib/plans/plan-comparison";
import { BILLING_PREF_KEY } from "@/lib/billing/preference";

type Features = { products?: number; services?: number; customDomain?: boolean };

/**
 * Landing-page pricing: a monthly/yearly switch (yearly takes 15% off twelve months, the same amount
 * checkout charges) and a "Compare all features" table that opens in place and can be closed again.
 */
export function PricingSection({ plans, ctaHref }: { plans: ComparablePlan[]; ctaHref: string }) {
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  const [open, setOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const ranked = useMemo(() => rankedPlans(plans), [plans]);
  const groups = useMemo(() => buildComparison(plans), [plans]);
  const percent = Math.round(YEARLY_DISCOUNT * 100);

  // Remember the choice so the plan picker at checkout opens on the same period.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BILLING_PREF_KEY);
      if (saved === "YEARLY") setPeriod("YEARLY");
    } catch { /* storage unavailable: keep the default */ }
  }, []);
  function choose(next: BillingPeriod) {
    setPeriod(next);
    try { localStorage.setItem(BILLING_PREF_KEY, next); } catch { /* ignore */ }
  }
  function toggleCompare(next: boolean) {
    setOpen(next);
    // Opening scrolls the table into view; closing brings the plan cards back so the reader is never stranded far down the page.
    requestAnimationFrame(() => (next ? tableRef.current : topRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const featuredIndex = ranked.length >= 3 ? Math.floor(ranked.length / 2) : -1;

  return (
    <div>
      <div ref={topRef} className="scroll-mt-24" />
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full p-1" style={{ background: "var(--bn-ink-raised)", border: "1px solid var(--bn-ink-line)" }} role="group" aria-label="Billing period">
          {(["MONTHLY", "YEARLY"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              aria-pressed={period === value}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition"
              style={period === value ? { background: "var(--bn-accent-gradient)", color: "#ffffff" } : { color: "var(--bn-mute)" }}
            >
              {value === "MONTHLY" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(52,211,153,0.15)", color: "var(--bn-accent-text)" }}>
          Save {percent}% when you pay yearly
        </span>
      </div>

      <div className={`grid gap-5 sm:grid-cols-2 ${ranked.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {ranked.map((p, index) => {
          const features = (p.features ?? {}) as Features;
          const featured = index === featuredIndex;
          const yearly = period === "YEARLY";
          return (
            <div
              key={p.id}
              className="relative rounded-2xl p-6 transition hover:-translate-y-1"
              style={{
                background: featured ? "var(--bn-accent-gradient)" : "var(--bn-ink-raised)",
                color: featured ? "#ffffff" : "var(--bn-ivory)",
                border: featured ? "none" : "1px solid var(--bn-ink-line)",
              }}
            >
              {featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-black/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Most popular</span>
              )}
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {formatMoney(effectiveMonthlyFor(p.price, period))}
                <span className="text-sm font-normal opacity-70">/mo</span>
              </p>
              {yearly ? (
                <p className="mt-1 text-xs" style={{ opacity: 0.85 }}>
                  Billed {formatMoney(yearlyPriceFor(p.price))} a year
                  <span className="mt-0.5 block font-semibold">You save {formatMoney(yearlySavingsFor(p.price))} a year</span>
                </p>
              ) : (
                <p className="mt-1 text-xs" style={{ opacity: 0.7 }}>Billed monthly</p>
              )}
              <ul className="mt-5 space-y-2 text-sm" style={{ opacity: featured ? 0.9 : 0.78 }}>
                <li>{p.commissionRate === 0 ? "No commission per sale" : `${p.commissionRate}% commission per sale`}</li>
                <li>{features.products === -1 ? "Unlimited products" : `Up to ${features.products ?? 0} products`}</li>
                <li>{features.services === -1 ? "Unlimited services" : `Up to ${features.services ?? 0} services`}</li>
                <li className="font-medium">{features.customDomain ? "✓ Your own domain name" : "Runs on your biznest.space address"}</li>
                {p.rank >= 2 && <li>✓ Business apps (PMS, HR, CRM, FnB and more)</li>}
                {p.rank >= 3 && <li>✓ Growth tools, ads and webhooks</li>}
              </ul>
              <Link
                href={ctaHref}
                className="mt-6 block rounded-full py-2.5 text-center text-sm font-medium transition hover:brightness-110"
                style={{ background: featured ? "#ffffff" : "var(--bn-accent-gradient)", color: featured ? "var(--bn-accent-text)" : "#ffffff" }}
              >
                Get started
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        {!open && (
          <button
            type="button"
            onClick={() => toggleCompare(true)}
            className="rounded-full px-5 py-2 text-sm font-medium transition hover:brightness-125"
            style={{ border: "1px solid var(--bn-ink-line)", color: "var(--bn-ivory)", background: "var(--bn-ink-raised)" }}
          >
            Compare all features
          </button>
        )}
      </div>

      {open && (
        <div ref={tableRef} className="mt-10 scroll-mt-24 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--bn-ink-line)", background: "var(--bn-ink-raised)" }}>
          <div className="sticky top-16 z-10 flex items-center justify-between gap-3 px-4 py-3" style={{ background: "var(--bn-ink-raised)", borderBottom: "1px solid var(--bn-ink-line)" }}>
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>Compare plans</h3>
              <p className="text-xs" style={{ color: "var(--bn-mute)" }}>Exactly what each plan includes.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleCompare(false)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition hover:brightness-125"
              style={{ border: "1px solid var(--bn-ink-line)", color: "var(--bn-ivory)" }}
              aria-label="Close the plan comparison"
            >
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr style={{ color: "var(--bn-mute)" }}>
                  <th className="px-4 py-3 font-medium">Feature</th>
                  {ranked.map((p) => (
                    <th key={p.id} className="px-4 py-3 font-semibold" style={{ color: "var(--bn-ivory)" }}>
                      {p.name}
                      <span className="block text-xs font-normal" style={{ color: "var(--bn-mute)" }}>
                        {formatMoney(effectiveMonthlyFor(p.price, period))}/mo
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.title}>
                  <tr>
                    <td colSpan={ranked.length + 1} className="px-4 pb-2 pt-5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--bn-accent-text)" }}>
                      {group.title}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} style={{ borderTop: "1px solid var(--bn-ink-line)" }}>
                      <td className="px-4 py-2.5" style={{ color: "var(--bn-mute)" }}>{row.label}</td>
                      {row.cells.map((cell, i) => (
                        <td key={i} className="px-4 py-2.5">
                          {cell === true ? (
                            <Check className="h-4 w-4" style={{ color: "var(--bn-accent-text)" }} aria-label="Included" />
                          ) : cell === false ? (
                            <Minus className="h-4 w-4 opacity-40" aria-label="Not included" />
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <div className="flex justify-center px-4 py-4" style={{ borderTop: "1px solid var(--bn-ink-line)" }}>
            <button
              type="button"
              onClick={() => toggleCompare(false)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-125"
              style={{ border: "1px solid var(--bn-ink-line)", color: "var(--bn-ivory)" }}
            >
              <X className="h-4 w-4" /> Close comparison
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
