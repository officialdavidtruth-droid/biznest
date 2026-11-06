"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, Heart, LogOut, Store } from "lucide-react";

const pill = "inline-flex items-center gap-2 rounded-full px-3 py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]";

/** Header account controls for Browse. Guests get Sign in / Join; signed-in people get Following and Sign out. */
export function AccountMenu({ signedIn, isMember, hasStore, unread = 0 }: { signedIn: boolean; isMember: boolean; hasStore: boolean; unread?: number }) {
  if (!signedIn) {
    return (
      <>
        <Link href="/login?callbackUrl=%2Fbrowse" className={`${pill} text-[#FBF6E9]/80 hover:text-white`}>Sign in</Link>
        <Link href="/join?callbackUrl=%2Fbrowse" className={`${pill} bg-[#F5B82E] text-[#14301A] hover:bg-[#ffc94d]`}>Join</Link>
      </>
    );
  }
  return (
    <>
      <Link href="/browse/notifications" className={`${pill} relative text-[#FBF6E9]/80 hover:text-white`} aria-label={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}>
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#F5B82E] px-1 text-[10px] font-bold leading-none text-[#14301A]">{unread > 9 ? "9+" : unread}</span>}
      </Link>
      <Link href="/browse/following" className={`${pill} text-[#FBF6E9]/80 hover:text-white`}><Heart className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Following</span></Link>
      {isMember && !hasStore && <Link href="/onboarding/business-verification" className={`${pill} hidden text-[#FBF6E9]/80 hover:text-white md:inline-flex`}><Store className="h-4 w-4" aria-hidden /> Open a business store</Link>}
      <button type="button" onClick={() => void signOut({ callbackUrl: "/browse" })} className={`${pill} text-[#FBF6E9]/70 hover:text-white`}><LogOut className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span></button>
    </>
  );
}
