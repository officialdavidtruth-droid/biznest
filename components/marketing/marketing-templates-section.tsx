"use client";

import Link from "next/link";
import type { MarketingBrand, MarketingItem } from "@/lib/email/marketing-templates";
import { EmailDesigner, useEmailDesign } from "@/components/marketing/email-designer";

/** Email template studio for the standalone Marketing workspace (dark theme, design + export). */
export function MarketingTemplatesSection({ slug, brand, items }: { slug: string; brand: MarketingBrand; items: MarketingItem[] }) {
  const design = useEmailDesign(brand, items);
  return (
    <section id="templates" className="mx-auto max-w-6xl px-5 pb-16 pt-4">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-orange-400">Email templates</p>
          <h2 className="mt-2 text-3xl font-extrabold text-white">Design an email that looks like you</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
            Choose from 6 curated designs, already styled with your logo, colours and business content. Change the wording, offer, pictures, colours, font and layout until it fits, then copy or download the HTML.
          </p>
        </div>
        <Link href={`/store/${slug}/admin/apps/crm/marketing`} className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-orange-400">Send from Marketing Studio</Link>
      </div>
      <EmailDesigner design={design} variant="dark" />
    </section>
  );
}
