"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hash } from "lucide-react";

/** Type a hashtag and go straight to its page. Trending tags are one tap away underneath. */
export function TagSearch({ trending }: { trending: { tag: string; posts: number }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const clean = q.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 30);
  const match = clean ? trending.filter((t) => t.tag.startsWith(clean)).slice(0, 5) : [];
  return (
    <div className="mb-3">
      <form onSubmit={(e) => { e.preventDefault(); if (clean.length >= 2) router.push(`/browse/tag/${encodeURIComponent(clean)}`); }} className="flex items-center gap-2 rounded-full bg-white/10 px-3 ring-1 ring-white/10 focus-within:ring-[#F5B82E]">
        <Hash className="h-4 w-4 shrink-0 text-[#F5B82E]" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a hashtag, e.g. ankara" aria-label="Search a hashtag" className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-white outline-none placeholder:text-white/50 sm:text-sm" />
        {clean.length >= 2 && <button type="submit" className="shrink-0 text-sm font-semibold text-[#F5B82E]">Go</button>}
      </form>
      {match.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-2xl bg-[#0F2A17] ring-1 ring-white/10">
          {match.map((t) => <li key={t.tag}><button type="button" onClick={() => router.push(`/browse/tag/${encodeURIComponent(t.tag)}`)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-white/5"><span>#{t.tag}</span><span className="text-xs text-white/50">{t.posts} {t.posts === 1 ? "post" : "posts"}</span></button></li>)}
        </ul>
      )}
      {trending.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none]" aria-label="Trending hashtags">
          <span className="shrink-0 self-center text-xs font-semibold text-white/60">Trending</span>
          {trending.map((t) => <a key={t.tag} href={`/browse/tag/${encodeURIComponent(t.tag)}`} className="shrink-0 rounded-full bg-[#F5B82E]/15 px-3 py-1 text-sm font-medium text-[#F5B82E] hover:bg-[#F5B82E]/25">#{t.tag}</a>)}
        </div>
      )}
    </div>
  );
}
