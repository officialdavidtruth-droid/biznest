"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lightbulb, X } from "lucide-react";
import { dismissChurnTip } from "@/lib/actions/churn";

type Props = { slug: string; id: string; title: string; body: string; href: string; cta: string; notifiedAt?: string | null };

/** One contextual tip at the top of the owner dashboard while a warning sign is open. */
export function ChurnTipCard({ slug, id, title, body, href, cta, notifiedAt }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Each new reminder pops up once when the owner opens the dashboard; the card below stays until they dismiss it.
  const seenKey = `churn-popup:${id}:${notifiedAt ?? "0"}`;
  const [popup, setPopup] = useState(false);
  useEffect(() => {
    if (!notifiedAt) return;
    try {
      if (!localStorage.getItem(seenKey)) setPopup(true);
    } catch { /* storage blocked: skip the pop-up, the card still shows */ }
  }, [seenKey, notifiedAt]);
  function closePopup() {
    try { localStorage.setItem(seenKey, "1"); } catch { /* ignore */ }
    setPopup(false);
  }
  return (
    <>
    {popup && (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="churn-popup-title" onClick={closePopup}>
        <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center gap-2 text-amber-700"><Lightbulb className="h-5 w-5" aria-hidden /><span className="text-xs font-semibold">A note from BizNest</span></div>
          <h2 id="churn-popup-title" className="text-lg font-semibold">{title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          <div className="mt-4 flex gap-2">
            <Link href={href} onClick={closePopup} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground">{cta}</Link>
            <button type="button" onClick={closePopup} className="rounded-lg border px-4 py-2.5 text-sm font-medium">Later</button>
          </div>
        </div>
      </div>
    )}
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm">{body}</p>
        <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline">
          {cta} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss tip"
        disabled={pending}
        onClick={() => start(async () => { await dismissChurnTip(slug, id); router.refresh(); })}
        className="rounded p-1 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
    </>
  );
}
