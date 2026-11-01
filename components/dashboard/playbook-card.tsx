"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";
import { canonicalizeBusinessType } from "@/lib/business-identity";
import { PLAYBOOK_CARD, playbookKeyFor } from "@/lib/playbook-meta";

/**
 * Catchy niche-specific ebook entry pinned to the bottom of the sidebar and
 * the mobile drawer. Copy comes from the business niche (see lib/playbook-meta.ts).
 */
export function PlaybookCard({ slug, category, onNavigate, className = "" }: { slug: string; category?: string | null; onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const href = `/${slug}/admin/playbook`;
  const copy = PLAYBOOK_CARD[playbookKeyFor(canonicalizeBusinessType(category))];
  const active = pathname === href || pathname === `/store/${slug}/admin/playbook`;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-tour="playbook"
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-amber-300 to-yellow-400 p-3 text-slate-900 shadow-md transition hover:brightness-105 ${active ? "ring-2 ring-white" : ""} ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-amber-300">
        <BookOpen className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-700">Free ebook</span>
        <span className="block truncate text-sm font-bold leading-tight">{copy.title}</span>
        <span className="block truncate text-[11px] text-slate-700">{copy.sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-700 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
