"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { toggleFollowStore } from "@/lib/actions/browse";
import { FOLLOW_NEEDS_ACCOUNT, compactCount } from "@/lib/browse";
import { ShareProfile } from "@/components/browse/share-profile";

const display = "font-[family-name:var(--font-browse-display)]";

/** Stats row plus Follow, Visit store and Share. Following updates the count straight away and rolls back if it fails. */
export function ProfileActions({ slug, name, path, storeUrl, initialFollowing, initialCount, postCount, likeCount, signedIn }: {
  signedIn: boolean; slug: string; name: string; path: string; storeUrl: string; initialFollowing: boolean; initialCount: number; postCount: number; likeCount: number;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();
  const [needAccount, setNeedAccount] = useState(false);

  function toggle() {
    if (!signedIn) { setNeedAccount(true); return; }
    const prev = { following, count };
    setFollowing(!following);
    setCount(Math.max(0, count + (following ? -1 : 1)));
    start(async () => {
      const r = await toggleFollowStore(slug);
      if (r.success) { setFollowing(r.data.following); setCount(r.data.followerCount); }
      else { setFollowing(prev.following); setCount(prev.count); if (r.error === FOLLOW_NEEDS_ACCOUNT) setNeedAccount(true); else toast.error(r.error); }
    });
  }

  const stat = (value: number, one: string, many: string) => (
    <div className="rounded-2xl bg-[#14301A]/[0.06] py-3">
      <dd className={`${display} text-2xl font-extrabold`}>{compactCount(value)}</dd>
      <dt className="text-xs text-[#14301A]/65">{value === 1 ? one : many}</dt>
    </div>
  );

  return (
    <>
      <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
        {stat(postCount, "Post", "Posts")}
        {stat(count, "Follower", "Followers")}
        {stat(likeCount, "Like", "Likes")}
      </dl>
      <div className="mt-5 grid gap-3">
        <button
          type="button" onClick={toggle} disabled={pending} aria-pressed={following}
          className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14301A] disabled:opacity-70 ${following ? "border border-[#14301A]/30 text-[#14301A] hover:bg-[#14301A]/5" : "bg-[#F5B82E] text-[#14301A] hover:bg-[#ffc94d]"}`}
        >
          {following ? <><Check className="h-4 w-4" aria-hidden /> Following</> : <><UserPlus className="h-4 w-4" aria-hidden /> Follow</>}
        </button>
        {needAccount && (
          <div role="alert" className="rounded-2xl bg-[#14301A]/[0.06] p-4 text-center">
            <p className="text-sm font-medium">Create a free account to follow {name}.</p>
            <p className="mt-1 text-xs text-[#14301A]/65">It&apos;s for browsing only. No store or dashboard is created.</p>
            <div className="mt-3 flex justify-center gap-2">
              <Link href={`/join?callbackUrl=${encodeURIComponent(path)}`} className="rounded-full bg-[#14301A] px-5 py-2 text-sm font-semibold text-[#FBF6E9] hover:bg-[#0c1f11]">Create account</Link>
              <Link href={`/login?callbackUrl=${encodeURIComponent(path)}`} className="rounded-full border border-[#14301A]/30 px-5 py-2 text-sm font-semibold hover:bg-[#14301A]/5">Sign in</Link>
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Link href={storeUrl} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#14301A] px-6 py-3 text-sm font-semibold text-[#FBF6E9] hover:bg-[#0c1f11] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14301A]"><Store className="h-4 w-4" aria-hidden /> Visit store</Link>
          <ShareProfile name={name} path={path} />
        </div>
      </div>
    </>
  );
}
