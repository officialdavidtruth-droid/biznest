import Link from "next/link";
import { Lock } from "lucide-react";
import type { MarketingToolAccess } from "@/lib/access/marketing-tool";

export function MarketingToolLocked({ access }: { access: MarketingToolAccess }) {
  const callbackUrl = "/marketing";

  if (access.status === "signed-out") {
    return (
      <section id="contacts" className="mx-auto max-w-6xl px-5 py-14">
        <LockedShell
          title="Sign in to use the Marketing tool"
          body="Create a free BizNest account (or sign in if you already have one) to import contacts, build campaigns and unlock the Marketing workspace."
        >
          <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="rounded-full bg-orange-500 px-6 py-3 font-bold text-slate-950 hover:bg-orange-400">
            Sign up
          </Link>
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="rounded-full border border-slate-500 px-6 py-3 font-semibold text-white hover:bg-white/10">
            Sign in
          </Link>
        </LockedShell>
      </section>
    );
  }

  // access.status === "needs-upgrade" — signed in, but no BizNest Marketing
  // subscription yet. This is never a full store's subscription page: BizNest
  // Marketing has its own signup and billing, separate from the main platform.
  return (
    <section id="contacts" className="mx-auto max-w-6xl px-5 py-14">
      <LockedShell
        title="Subscribe to BizNest Marketing"
        body="The Marketing workspace — contact import, campaigns and insights — is a standalone BizNest Marketing subscription, separate from your BizNest store. Sign up to unlock it."
      >
        <Link href="/marketing/signup" className="rounded-full bg-orange-500 px-6 py-3 font-bold text-slate-950 hover:bg-orange-400">
          Subscribe to Marketing
        </Link>
      </LockedShell>
    </section>
  );
}

function LockedShell({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/15">
        <Lock className="h-6 w-6 text-orange-400" />
      </div>
      <h2 className="mt-4 text-2xl font-extrabold text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">{body}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>
    </div>
  );
}