"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { marketingSignupSchema, signUpForMarketing, type MarketingSignupInput } from "@/lib/actions/marketing-signup";
import { CANONICAL_BUSINESS_TYPES } from "@/lib/business-identity";

const field =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200";

/**
 * The entire signup: name/email/password + business name/niche/phone.
 * No template, plan, product/service setup, or ID verification — that's
 * the point (see signUpForMarketing in lib/actions/marketing-signup.ts).
 */
export function MarketingSignupForm() {
  const router = useRouter();
  const [values, setValues] = useState<MarketingSignupInput>({
    name: "", email: "", password: "", businessName: "", niche: "", phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function set<K extends keyof MarketingSignupInput>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = marketingSignupSchema.safeParse(values);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""])));
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    const result = await signUpForMarketing(values);
    if (!result.success) {
      setIsSubmitting(false);
      toast.error(result.error);
      return;
    }
    const signInResult = await signIn("credentials", { email: values.email, password: values.password, redirect: false });
    setIsSubmitting(false);
    if (signInResult?.error) {
      toast.success("Account created — sign in to continue.");
      router.push(`/login?callbackUrl=${encodeURIComponent("/store/marketing")}&email=${encodeURIComponent(values.email)}`);
      return;
    }
    toast.success(`You're in. Templates are set up for ${result.data.storeSlug ? "your niche" : "you"}.`);
    router.push("/store/marketing");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="name">Your name</label>
        <input id="name" className={field} placeholder="Amaka Chukwu" value={values.name} onChange={(e) => set("name", e.target.value)} />
        {errors.name && <p className="mt-1 text-xs text-orange-300">{errors.name}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="email">Email</label>
        <input id="email" type="email" className={field} placeholder="you@example.com" value={values.email} onChange={(e) => set("email", e.target.value)} />
        {errors.email && <p className="mt-1 text-xs text-orange-300">{errors.email}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="password">Password</label>
        <input id="password" type="password" className={field} placeholder="At least 8 characters" value={values.password} onChange={(e) => set("password", e.target.value)} />
        {errors.password && <p className="mt-1 text-xs text-orange-300">{errors.password}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="phone">Phone</label>
        <input id="phone" className={field} placeholder="0803 000 0000" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        {errors.phone && <p className="mt-1 text-xs text-orange-300">{errors.phone}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="businessName">Business name</label>
        <input id="businessName" className={field} placeholder="Truth Hotel" value={values.businessName} onChange={(e) => set("businessName", e.target.value)} />
        {errors.businessName && <p className="mt-1 text-xs text-orange-300">{errors.businessName}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="niche">Niche</label>
        <select id="niche" className={field} value={values.niche} onChange={(e) => set("niche", e.target.value)}>
          <option value="" disabled>Choose your niche</option>
          {CANONICAL_BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {errors.niche && <p className="mt-1 text-xs text-orange-300">{errors.niche}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="sm:col-span-2 rounded-full bg-orange-500 px-7 py-3.5 font-bold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
      >
        {isSubmitting ? "Setting up your workspace…" : "Start marketing — no setup"}
      </button>
      <p className="sm:col-span-2 text-center text-xs text-slate-400">
        We pick your email templates from your niche automatically. No storefront, no ID verification, no plan to choose.
      </p>
    </form>
  );
}