import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DiscoverShop } from "@/lib/browse-data";
import { compactCount, isOfficialSlug, storeBrowsePath } from "@/lib/browse";
import { StoreBadges } from "@/components/browse/store-badges";

const display = "font-[family-name:var(--font-browse-display)]";

export function DiscoverShops({ shops, title = "Shops to visit" }: { shops: DiscoverShop[]; title?: string }) {
  if (shops.length === 0) return null;
  return (
    <section aria-label={title} className="overflow-hidden rounded-3xl bg-[#FBF6E9] p-4 text-[#14301A] shadow-[0_14px_32px_-20px_rgba(0,0,0,.65)]">
      <h2 className={`${display} text-base font-extrabold tracking-tight`}>{title}</h2>
      <ul className="mt-2 divide-y divide-[#14301A]/10">
        {shops.map((s) => (
          <li key={s.slug}>
            <Link href={storeBrowsePath(s.slug)} className="group -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-[#14301A]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14301A]">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#14301A]/10 text-sm font-bold">
                {s.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logoUrl} alt="" className="h-full w-full object-cover" /> : s.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm font-semibold">{s.name}<StoreBadges verified={s.verified} mogul={s.mogul} official={isOfficialSlug(s.slug)} /></span>
                <span className="block truncate text-xs text-[#14301A]/60">{[s.category, s.city].filter(Boolean).join(", ")}{s.followerCount > 0 ? `${s.category || s.city ? ", " : ""}${compactCount(s.followerCount)} follower${s.followerCount === 1 ? "" : "s"}` : ""}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#14301A]/40 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SellCta() {
  return (
    <section className="rounded-3xl bg-[#F5B82E] p-4 text-[#14301A] shadow-[0_18px_40px_-20px_rgba(0,0,0,.65)]">
      <h2 className={`${display} text-lg font-extrabold leading-tight tracking-tight`}>Run a business?</h2>
      <p className="mt-1.5 text-sm leading-relaxed">Open a store on BizNest and post your products and daily updates here, for free.</p>
      <Link href="/register" className="mt-3 inline-flex rounded-full bg-[#14301A] px-4 py-2 text-sm font-semibold text-[#FBF6E9] hover:bg-[#0c1f11] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14301A]">Open your store</Link>
    </section>
  );
}
