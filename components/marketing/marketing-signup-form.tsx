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
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function set<K extends keyof MarketingSignupInput>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError("");
    const parsed = marketingSignupSchema.safeParse(values);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const nextErrors = Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""]));
      setErrors(nextErrors);
      setSubmitError("Please complete the highlighted fields before continuing.");
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await signUpForMarketing(parsed.data);
      if (!result.success) {
        setSubmitError(result.error);
        toast.error(result.error);
        return;
      }

      const signInResult = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        storeSlug: result.data.storeSlug,
        redirect: false,
      });

      if (signInResult?.error) {
        const message = "Account created successfully. Sign in to continue.";
        toast.success(message);
        router.push(`/login?callbackUrl=${encodeURIComponent("/marketing/select-plan?slug=" + result.data.storeSlug)}&email=${encodeURIComponent(parsed.data.email)}&marketingStore=${encodeURIComponent(result.data.storeSlug)}`);
        return;
      }

      toast.success("Your Marketing workspace is ready. Choose your plan to continue.");
      router.replace(`/marketing/select-plan?slug=${encodeURIComponent(result.data.storeSlug)}`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "We could not create your Marketing workspace. Please try again.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      {submitError && (
        <div role="alert" className="sm:col-span-2 rounded-2xl border border-red-300/30 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-100">
          {submitError}
        </div>
      )}
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
          <input id={key} name={key} type={type} required={key !== "website" && key !== "address"} autoComplete={key === "password" ? "new-password" : key === "email" ? "email" : undefined} className={field} placeholder={placeholder} value={String(values[key as keyof MarketingSignupInput] ?? "")} onChange={(e) => set(key as keyof MarketingSignupInput, e.target.value)} />
          {errors[key] && <p className="mt-1 text-xs text-red-300">{errors[key]}</p>}
        </div>
      ))}
      <div>
        <label className="text-sm font-medium text-slate-200" htmlFor="niche">Business niche</label>
        <select id="niche" name="niche" required className={field} value={values.niche} onChange={(e) => set("niche", e.target.value)}>
          <option value="" disabled>Choose your niche</option>
          {CANONICAL_BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {errors.niche && <p className="mt-1 text-xs text-red-300">{errors.niche}</p>}
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="description">What does your business do?</label>
        <textarea id="description" name="description" required rows={4} className={field + " resize-y"} placeholder="Tell us what you sell or the services you provide, who you serve, and what you want to promote." value={values.description} onChange={(e) => set("description", e.target.value)} />
        {errors.description && <p className="mt-1 text-xs text-red-300">{errors.description}</p>}
      </div>
      <button type="submit" disabled={isSubmitting} className="sm:col-span-2 cursor-pointer rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-lime-500 px-7 py-4 font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">
        {isSubmitting ? "Setting up your workspace…" : "Create my Marketing workspace"}
      </button>
      <p className="sm:col-span-2 text-center text-xs text-slate-400">
        No storefront, government ID, or product catalog is required. Your niche and business information personalize your CRM, Customer 360 and email templates.
      </p>
    </form>
  );

}