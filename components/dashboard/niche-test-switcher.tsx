"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { switchBusinessTypeForTesting } from "@/lib/actions/niche-test";

/** Temporary testing card: lets the owner flip this store between business types. See lib/niche-test.ts. */
export function NicheTestSwitcher({ slug, current, options }: { slug: string; current: string; options: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  async function apply() {
    setSaving(true);
    try {
      const r = await switchBusinessTypeForTesting(slug, value);
      if (!r.success) { toast.error(r.error); return; }
      toast.success(`Switched from ${r.data.from} to ${r.data.to}.`);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
      <h2 className="text-base font-semibold">Switch business type (testing only)</h2>
      <p className="mt-1 text-sm text-muted-foreground">Changes which niche this store behaves as, so you can check each niche&apos;s dashboard and apps. Current type: <b>{current}</b>. Switch it back when you&apos;re done.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="niche-test" className="sr-only">Business type</label>
        <select id="niche-test" value={value} onChange={(e) => setValue(e.target.value)} className="h-10 min-w-[220px] rounded-md border bg-background px-3 text-sm">
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <button type="button" onClick={apply} disabled={saving || value === current} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {saving ? "Switching…" : "Switch"}
        </button>
      </div>
    </section>
  );
}
