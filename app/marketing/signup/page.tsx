// Route: /marketing/signup
// The fast path into BizNest Marketing: business info only, no storefront
// setup, no ID verification, no plan choice. See signUpForMarketing in
// lib/actions/marketing-signup.ts. Accounts made here land on
// /store/marketing only -- never the full admin dashboard (see the
// marketingOnly checks in app/store/[slug]/admin/layout.tsx).
import Link from "next/link";
import { MarketingSignupForm } from "@/components/marketing/marketing-signup-form";

export default function MarketingSignupPage() {
  return (
    <main className="min-h-screen bg-[#052e1d] text-white">
      <header className="border-b border-slate-700 bg-[#063b25]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-xl font-extrabold text-white">BizNest <span className="text-lime-300">Marketing</span></Link>
          <Link className="text-sm font-medium text-slate-200 hover:text-white" href="/login?callbackUrl=%2Fstore%2Fmarketing">Sign in instead</Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-lime-300">Get started</p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Just your business info.<br /><span className="text-lime-300">Nothing else.</span></h1>
        <p className="mt-4 max-w-xl text-slate-300">
          No storefront to build, no template to pick, no ID to upload. Tell us your niche and we set up your contacts, campaigns and email templates to match it.
        </p>
        <div className="mt-8 rounded-3xl border border-blue-800 bg-[#063b25]/80 p-6 shadow-2xl sm:p-8">
          <MarketingSignupForm />
        </div>
      </section>
    </main>
  );
}