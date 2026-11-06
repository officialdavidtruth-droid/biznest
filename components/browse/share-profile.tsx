"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

export function ShareProfile({ name, path }: { name: string; path: string }) {
  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  }
  return (
    <button type="button" onClick={share} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#14301A]/25 px-5 py-3 text-sm font-semibold hover:bg-[#14301A]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14301A]">
      <Share2 className="h-4 w-4" aria-hidden /> Share
    </button>
  );
}
