"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, Copy, MessageCircle, Sparkles, X } from "lucide-react";
import { addStarterListings, dismissFirstSaleChecklist, markStoreLinkShared } from "@/lib/actions/onboarding-checklist";
import type { ChecklistStep, StarterIdea } from "@/lib/onboarding-checklist";
import type { ActionResult } from "@/types/actions";

type Props = {
  slug: string;
  storeName: string;
  /** Public URL customers are sent to (custom domain when verified). */
  publicUrl: string;
  steps: ChecklistStep[];
  doneCount: number;
  total: number;
  complete: boolean;
  /** Plural noun for this business ("products", "menu items", ...). */
  listingNoun: string;
  ideas: StarterIdea[];
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/**
 * "Get your first sale" card shown at the top of the owner dashboard. Four steps
 * (logo, 3 listings, payout, share link); each links to the place that completes it.
 * Progress is computed on the server from real data, so it can't drift: this component
 * only triggers actions and refreshes.
 */
export function FirstSaleChecklist({ slug, storeName, publicUrl, steps, doneCount, total, complete, listingNoun, ideas }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(ideas.slice(0, 3).map((i) => i.id)));

  function run<T>(task: () => Promise<ActionResult<T>>, successMessage?: string) {
    startTransition(async () => {
      const result = await task();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (successMessage) toast.success(successMessage);
      router.refresh();
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      // Not copied, so don't count it as shared.
      toast.error("Couldn't copy automatically. Press and hold the link to copy it.");
      return;
    }
    run(() => markStoreLinkShared(slug), "Store link copied");
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Shop at ${storeName}: ${publicUrl}`)}`;

  function toggleIdea(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function dismiss() {
    if (!window.confirm("Hide this checklist? It won't come back.")) return;
    run(() => dismissFirstSaleChecklist(slug));
  }

  const pct = Math.round((doneCount / total) * 100);

  if (complete) {
    return (
      <section className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[16px] font-bold">You&apos;re set up and ready for your first sale</h2>
            <p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">Keep sharing your store link: that&apos;s what brings in orders.</p>
          </div>
        </div>
        <button type="button" onClick={dismiss} disabled={pending} className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--bn-admin-muted)] hover:bg-muted">
          Hide
        </button>
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5" data-tour="first-sale-checklist">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold">Get your first sale</h2>
          <p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">
            {doneCount} of {total} done. Finish these four steps and you&apos;re ready to take orders.
          </p>
        </div>
        <button type="button" onClick={dismiss} disabled={pending} aria-label="Hide checklist" className="shrink-0 rounded-md p-1.5 text-[var(--bn-admin-muted)] hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Setup progress">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-4 divide-y divide-[var(--bn-admin-border)]">
        {steps.map((step, index) => {
          const href = step.href ? `/${slug}/admin${step.href}` : null;
          return (
            <li key={step.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    step.done ? "bg-primary text-primary-foreground" : "border border-[var(--bn-admin-border)] text-[var(--bn-admin-muted)]"
                  }`}
                  aria-hidden="true"
                >
                  {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${step.done ? "text-[var(--bn-admin-muted)] line-through" : "text-[var(--bn-admin-text)]"}`}>
                        {step.title}
                        {step.done && <span className="sr-only"> (done)</span>}
                      </p>
                      {!step.done && <p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">{step.description}</p>}
                    </div>

                    {!step.done && href && (
                      <div className="flex shrink-0 items-center gap-2">
                        {step.id === "listings" && ideas.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIdeasOpen((v) => !v)}
                            aria-expanded={ideasOpen}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bn-admin-border)] px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Starter ideas
                          </button>
                        )}
                        {step.hardLink ? (
                          <a href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                            {step.cta} <ArrowRight className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                            {step.cta} <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  {step.id === "share" && !step.done && (
                    <div className="mt-2.5 space-y-2">
                      <p className="truncate rounded-lg border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] px-3 py-2 font-mono text-xs text-[var(--bn-admin-text)]">{publicUrl}</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={copyLink} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bn-admin-border)] px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                          <Copy className="h-3.5 w-3.5" /> Copy link
                        </button>
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => run(() => markStoreLinkShared(slug))}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
                        </a>
                      </div>
                    </div>
                  )}

                  {step.id === "listings" && !step.done && ideasOpen && ideas.length > 0 && (
                    <div className="mt-3 rounded-lg border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] p-3">
                      <p className="text-xs text-[var(--bn-admin-muted)]">
                        Pick the ones that fit your business. They&apos;re added as <strong className="font-semibold text-[var(--bn-admin-text)]">drafts</strong>: open each one to set your real price, photo
                        {ideas.some((i) => i.kind === "product") ? " and stock" : ""}, then publish. Nothing goes live until you do.
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {ideas.map((idea) => (
                          <li key={idea.id}>
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 hover:bg-muted">
                              <input type="checkbox" checked={selected.has(idea.id)} onChange={() => toggleIdea(idea.id)} className="mt-0.5 h-4 w-4 accent-[var(--bn-admin-orange,currentColor)]" />
                              <span className="min-w-0 flex-1 text-xs">
                                <span className="font-semibold text-[var(--bn-admin-text)]">{idea.name}</span>
                                <span className="ml-1.5 text-[var(--bn-admin-muted)]">{naira(idea.price)} (placeholder)</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        disabled={pending || selected.size === 0}
                        onClick={() => run(() => addStarterListings(slug, Array.from(selected)), `Added as drafts. Open them to set your price and publish.`)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {pending ? "Adding..." : `Add ${selected.size} as drafts`}
                      </button>
                      <p className="mt-2 text-[11px] text-[var(--bn-admin-muted)]">Drafts appear under your {listingNoun} list.</p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
