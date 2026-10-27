"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lightbulb, X } from "lucide-react";
import { dismissChurnTip } from "@/lib/actions/churn";

type Props = { slug: string; id: string; title: string; body: string; href: string; cta: string };

/** One contextual tip at the top of the owner dashboard while a warning sign is open. */
export function ChurnTipCard({ slug, id, title, body, href, cta }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
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
  );
}
