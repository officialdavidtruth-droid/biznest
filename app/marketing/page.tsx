import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getMarketingToolAccess } from "@/lib/access/marketing-tool";
import { getMarketingFreeTrialSetting } from "@/lib/actions/site-settings";

const features = [
  ["CRM pipeline", "Capture leads, qualify prospects, track deals and follow every opportunity from one place."],
  ["Customer 360", "Keep contact details, notes, lead history and follow-ups together so every conversation has context."],
  ["Email marketing", "Create niche-aware campaigns with images, offers, discounts, CTAs and your own business identity."],
  ["Automation", "Set a trigger once and let follow-up emails, lead reminders and re-engagement journeys run automatically."],
  ["Sales & revenue", "Track won opportunities, pipeline value and revenue signals without opening a storefront."],
  ["Niche-aware workspace", "Hotel, salon, real estate, professional service and other businesses get workflows and templates tailored to their niche."],
];

export default async function MarketingLandingPage() {
  const session = await auth();
  const access = await getMarketingToolAccess(session?.user?.id);
  const [plans, trial] = await Promise.all([
    prisma.subscription.findMany({
      where: { isActive: true, isMarketingPlan: true },
      orderBy: { price: "asc" },
      select: { id: true, name: true, price: true, interval: true, features: true },
    }),
    getMarketingFreeTrialSetting(),
  ]);
  const marketingTrial = trial.enabled && plans.some((p) => p.id === trial.planId) ? trial.days : null;

  return (
    <main className="min-h-screen bg-[#f7fbf8] text-[#102a1c]">
      <header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-black tracking-tight">BizNest <span className="text-emerald-600">Marketing</span></Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {access.status === "active" && <Link href="/store/marketing" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Open workspace</Link>}
            {access.status !== "active" && <Link href="/marketing/signup" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Get started</Link>}
            <Link href="/login?callbackUrl=%2Fstore%2Fmarketing" className="hidden rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 sm:block">Sign in</Link>
          </div>
        </div>
      </header>

      <section className="overflow-hidden bg-gradient-to-br from-[#063b25] via-[#0a6b3a] to-[#23a455] text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-[1.05fr_.95fr] md:items-center md:py-28">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.24em] text-emerald-100">Standalone business growth platform</p>
            <h1 className="mt-5 text-5xl font-black leading-[1.02] sm:text-7xl">Market your business.<br /><span className="text-lime-200">Build relationships.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-emerald-50">BizNest Marketing gives businesses a CRM pipeline, Customer 360, email campaigns, automated follow-ups and sales tracking — without requiring a storefront.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/marketing/signup" className="rounded-2xl bg-white px-6 py-3.5 font-extrabold text-emerald-800 shadow-xl hover:bg-emerald-50">Start your marketing workspace</Link>
              <a href="#pricing" className="rounded-2xl border border-white/30 bg-white/10 px-6 py-3.5 font-bold text-white backdrop-blur">See pricing</a>
            </div>
            {marketingTrial && <p className="mt-4 text-sm text-emerald-100">{marketingTrial}-day free trial configured by BizNest Superadmin.</p>}
          </div>
          <div className="rounded-[2rem] border border-white/20 bg-[#052e1d]/55 p-5 shadow-2xl backdrop-blur">
            <div className="rounded-2xl bg-white p-5 text-[#102a1c] shadow-xl">
              <div className="flex items-center justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Marketing overview</p><p className="mt-1 text-lg font-black">Your business at a glance</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Live</span></div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {["Leads", "Customers", "Campaigns", "Revenue"].map((x, i) => <div key={x} className="rounded-2xl bg-[#f3faf5] p-4"><p className="text-xs text-slate-500">{x}</p><p className="mt-2 text-2xl font-black">{["124","86","18","₦2.4m"][i]}</p></div>)}
              </div>
              <div className="mt-3 rounded-2xl bg-emerald-700 p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Automation</p><p className="mt-1 font-bold">Welcome → nurture → follow up → convert</p><p className="mt-1 text-xs text-emerald-100">Runs automatically after you set it once.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-20">
        <div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-widest text-emerald-700">Everything in one workspace</p><h2 className="mt-3 text-4xl font-black tracking-tight">The tools you need to turn attention into relationships and revenue.</h2></div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body], i) => <article key={title} className="rounded-3xl border border-emerald-100 bg-white p-7 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 font-black text-emerald-700">0{i+1}</span><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></article>)}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#0b3d28] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <p className="text-sm font-black uppercase tracking-widest text-lime-300">Simple onboarding</p><h2 className="mt-3 text-4xl font-black">Tell BizNest about your business. We shape the workspace around it.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {["Create your account", "Tell us your niche & business details", "Import or capture contacts", "Build campaigns and automate follow-up"].map((x,i)=><div key={x} className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-3xl font-black text-lime-300">0{i+1}</p><p className="mt-5 font-bold">{x}</p></div>)}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-5 py-20">
        <div className="text-center"><p className="text-sm font-black uppercase tracking-widest text-emerald-700">Pricing</p><h2 className="mt-3 text-4xl font-black">Choose the Marketing plan configured by BizNest.</h2><p className="mx-auto mt-3 max-w-2xl text-slate-600">Prices and trial availability are controlled by the BizNest Superadmin and shown here automatically.</p></div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
          {plans.length ? plans.map((plan) => <div key={plan.id} className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm"><h3 className="text-xl font-black">{plan.name}</h3><div className="mt-5 flex items-end gap-2"><span className="text-5xl font-black">₦{Number(plan.price).toLocaleString()}</span><span className="pb-2 text-sm text-slate-500">/{String(plan.interval).toLowerCase()}</span></div><ul className="mt-6 space-y-3 text-sm text-slate-600"><li>✓ CRM & sales pipeline</li><li>✓ Customer 360</li><li>✓ Email marketing & templates</li><li>✓ Automated customer journeys</li></ul><Link href="/marketing/signup" className="mt-7 block rounded-2xl bg-emerald-700 px-5 py-3 text-center font-bold text-white">Start with {plan.name}</Link></div>) : <div className="rounded-3xl border border-dashed p-10 text-center text-slate-500">Marketing plans are being configured by the Superadmin.</div>}
        </div>
      </section>

      <footer className="bg-[#052e1d] text-emerald-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4">
          <div className="md:col-span-2"><p className="text-2xl font-black">BizNest <span className="text-lime-300">Marketing</span></p><p className="mt-3 max-w-md text-sm leading-6 text-emerald-100/80">A standalone growth workspace for businesses that want CRM, email marketing and automation without opening an online store.</p></div>
          <div><p className="font-bold">Product</p><div className="mt-3 grid gap-2 text-sm text-emerald-100/70"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#how-it-works">How it works</a></div></div>
          <div><p className="font-bold">Account</p><div className="mt-3 grid gap-2 text-sm text-emerald-100/70"><Link href="/marketing/signup">Sign up</Link><Link href="/login?callbackUrl=%2Fstore%2Fmarketing">Sign in</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div></div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-emerald-100/60">© {new Date().getFullYear()} BizNest. All rights reserved.</div>
      </footer>
    </main>
  );
}
