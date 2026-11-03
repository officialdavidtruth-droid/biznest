"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSiteMode } from "@/lib/actions/site-mode";
import type { SiteMode } from "@/lib/site-mode";

/** The "Advanced options" switch on the My Website screen. */
export function SiteModeToggle({ slug, initialMode, canChange }: { slug: string; initialMode: SiteMode; canChange: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<SiteMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const on = mode === "ADVANCED";

  function flip() {
    if (!canChange || pending) return;
    const next: SiteMode = on ? "SIMPLE" : "ADVANCED";
    setError(null);
    setMode(next); // show the change straight away
    startTransition(async () => {
      const result = await setSiteMode(slug, next);
      if (!result.success) {
        setMode(on ? "ADVANCED" : "SIMPLE"); // put it back
        setError(result.error);
        return;
      }
      router.refresh(); // redraw the side menu
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Advanced options</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn this on if you know your way around websites. It shows extra tools such as your own menu links, the order of sections, fonts and colours.
            Turning it off just hides them again. Nothing you have set is lost.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Advanced options"
          disabled={!canChange || pending}
          onClick={flip}
          className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-emerald-600" : "bg-muted-foreground/30"}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      {!canChange && <p className="mt-2 text-xs text-muted-foreground">Only the owner or a manager can change this.</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
