"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { signUpForMarketing } from "@/lib/actions/marketing-signup";
import { marketingSignupSchema, type MarketingSignupInput } from "@/lib/schemas/marketing-signup";
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
    description: "", country: "Nigeria", state: "", city: "", website: "", address: "",
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
    const signInResult = await signIn("credentials", { email: values.email, password: values.password, storeSlug: result.data.storeSlug, redirect: false });
    setIsSubmitting(false);
    if (signInResult?.error) {
      toast.success("Account created — sign in to continue.");
      router.push(`/login?callbackUrl=${encodeURIComponent("/store/marketing")}&email=${encodeURIComponent(values.email)}&marketingStore=${encodeURIComponent(result.data.storeSlug)}`);
      return;
    }
    toast.success(`You're in. Templates are set up for ${result.data.storeSlug ? "your niche" : "you"}.`);
    // One more step before the workspace unlocks: BizNest Marketing is on
    // its own paid plan (Starter/Pro) now, not automatically granted on
    // signup -- see getMarketingToolAccess in lib/access/marketing-tool.ts.
    router.push(`/marketing/select-plan?slug=${encodeURIComponent(result.data.storeSlug)}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      {[
        ["name","Your name","Amaka Chukwu","text"],
        ["email","Email","you@example.com","email"],
        ["password","Password","At least 8 characters","password"],
        ["phone","Phone","0803 000 0000","text"],
        ["businessName","Business name","Truth Hotel","text"],
        ["website","Website (optional)","https://yourbusiness.com","url"],
        ["country","Country","Nigeria","text"],
        ["state","State","FCT","text"],
        ["city","City","Abuja","text"],
        ["address","Business address (optional)","33 Business Street","text"],
      ].map(([key,label,placeholder,type]) => (
        <div key={key}>
          <label className="text-sm font-medium text-slate-200" htmlFor={key}>{label}</label>
          <input id={key} type={type} className={field} placeholder={placeholder} value={String(values[key as keyof MarketingSignupInput] ?? "")} onChange={(e) => set(key as keyof MarketingSignupInput, e.target.value)} />
          {errors[key] && <p className="mt-1 text-xs text-red-300">{errors[key]}</p>}
        </div>
      ))}
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="niche">Business niche</label>
        <select id="niche" className={field} value={values.niche} onChange={(e) => set("niche", e.target.value)}>
          <option value="" disabled>Choose your niche</option>
          {CANONICAL_BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {errors.niche && <p className="mt-1 text-xs text-red-300">{errors.niche}</p>}
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="description">What does your business do?</label>
        <textarea id="description" rows={4} className={field + " resize-y"} placeholder="Tell us what you sell or the services you provide, who you serve, and what you want to promote." value={values.description} onChange={(e) => set("description", e.target.value)} />
        {errors.description && <p className="mt-1 text-xs text-red-300">{errors.description}</p>}
      </div>
      <button type="submit" disabled={isSubmitting} className="sm:col-span-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-lime-500 px-7 py-4 font-bold text-white shadow-lg shadow-emerald-900/20 hover:brightness-105 disabled:opacity-60">
        {isSubmitting ? "Setting up your workspace…" : "Create my Marketing workspace"}
      </button>
      <p className="sm:col-span-2 text-center text-xs text-slate-400">
        No storefront, government ID, or product catalog is required. Your niche and business information personalize your CRM, Customer 360 and email templates.
      </p>
    </form>
  );

}